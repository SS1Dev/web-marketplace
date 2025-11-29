import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createPromptpayCharge } from '@/lib/omise'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createPaymentSchema = z.object({
	orderId: z.string(),
	amount: z.number(),
})

export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions)

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { orderId, amount } = createPaymentSchema.parse(body)

		// Get order
		const order = await prisma.order.findUnique({
			where: { id: orderId },
		})

		if (!order) {
			return NextResponse.json({ error: 'Order not found' }, { status: 404 })
		}

		if (order.userId !== session.user.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		if (order.status !== 'pending') {
			return NextResponse.json(
				{ error: 'Order is not pending payment' },
				{ status: 400 },
			)
		}

		// Check if order already has a charge ID (prevent duplicate payment creation)
		if (order.omiseChargeId) {
			// Return existing charge info
			return NextResponse.json({
				chargeId: order.omiseChargeId,
				qrCodeUrl: order.qrCodeUrl,
			})
		}

		// Get order items to build description from product names
		const orderItems = await prisma.orderItem.findMany({
			where: { orderId },
		})

		// Build description from product names
		// Type assertion needed because Prisma doesn't know about embedded Json fields at compile time
		const productNames = orderItems.map((item) => {
			const orderItemWithData = item as any
			const productData = orderItemWithData.productData || {}
			const productName = productData?.name || 'Unknown Product'
			const quantity = item.quantity > 1 ? ` x${item.quantity}` : ''
			return `${productName}${quantity}`
		})

		const description = productNames.length > 0
			? productNames.join(', ')
			: `Order #${orderId.slice(0, 8)}`

		// Create Omise charge first (before updating database)
		// This ensures we have a valid charge ID before committing to database
		let charge
		try {
			charge = await createPromptpayCharge({
				amount,
				orderId,
				description,
			})
		} catch (chargeError) {
			console.error('Error creating Omise charge:', chargeError)
			return NextResponse.json(
				{ error: 'Failed to create payment charge' },
				{ status: 500 },
			)
		}

		// Check if charge ID already exists in another order
		const existingOrderWithCharge = await prisma.order.findUnique({
			where: { omiseChargeId: charge.id },
		})

		if (existingOrderWithCharge) {
			// Charge ID already exists
			if (existingOrderWithCharge.id === orderId) {
				// Same order, return existing info
				return NextResponse.json({
					chargeId: charge.id,
					qrCodeUrl: existingOrderWithCharge.qrCodeUrl,
				})
			}
			// Different order, this shouldn't happen but handle it
			return NextResponse.json(
				{ error: 'Charge ID conflict' },
				{ status: 409 },
			)
		}

		// Use updateMany with condition to atomically update only if omiseChargeId is still null
		// This prevents race conditions where multiple requests try to create payment simultaneously
		const updateResult = await prisma.order.updateMany({
			where: {
				id: orderId,
				omiseChargeId: null, // Only update if omiseChargeId is still null
				status: 'pending', // And status is still pending
			},
			data: {
				omiseChargeId: charge.id,
				qrCodeUrl: charge.qr_code_url || null,
				paymentMethod: 'promptpay',
			},
		})

		// If no rows were updated, another request already created the payment
		if (updateResult.count === 0) {
			// Fetch the order again to get the existing charge info
			const existingOrder = await prisma.order.findUnique({
				where: { id: orderId },
			})

			if (existingOrder?.omiseChargeId) {
				// Another request succeeded, return existing payment info
				return NextResponse.json({
					chargeId: existingOrder.omiseChargeId,
					qrCodeUrl: existingOrder.qrCodeUrl,
				})
			}

			// Order status might have changed
			return NextResponse.json(
				{ error: 'Order status changed. Please refresh and try again.' },
				{ status: 409 },
			)
		}

		return NextResponse.json({
			chargeId: charge.id,
			qrCodeUrl: charge.qr_code_url,
		})
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.errors },
				{ status: 400 },
			)
		}

		console.error('Error creating payment:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		)
	}
}

