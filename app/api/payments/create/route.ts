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

		if (!orderItems || orderItems.length === 0) {
			console.error('Order has no items:', { orderId })
			return NextResponse.json(
				{
					error: 'Invalid order',
					message: 'Order has no items. Please contact support.',
				},
				{ status: 400 },
			)
		}

		// Build description from product names
		// Type assertion needed because Prisma doesn't know about embedded Json fields at compile time
		const productNames = orderItems.map((item) => {
			try {
				const orderItemWithData = item as any
				const productData = orderItemWithData.productData || {}
				const productName = productData?.name || 'Unknown Product'
				const quantity = item.quantity > 1 ? ` x${item.quantity}` : ''
				return `${productName}${quantity}`
			} catch (error) {
				console.error('Error processing order item:', { itemId: item.id, error })
				return `Item x${item.quantity || 1}`
			}
		})

		const description = productNames.length > 0
			? productNames.join(', ')
			: `Order #${orderId.slice(0, 8)}`

		// Validate amount against Omise PromptPay limits
		// According to Omise PromptPay documentation:
		// - Minimum: 2000 satang (THB 20.00)
		// - Maximum: 15000000 satang (THB 150,000.00)
		const amountInSatang = Math.round(amount * 100)
		
		if (amountInSatang < 2000) {
			return NextResponse.json(
				{
					error: 'Amount too low',
					message: 'Amount must be at least THB 20.00 for PromptPay payment.',
				},
				{ status: 400 },
			)
		}
		
		if (amountInSatang > 15000000) {
			return NextResponse.json(
				{
					error: 'Amount too high',
					message: 'Amount cannot exceed THB 150,000.00 for PromptPay payment.',
				},
				{ status: 400 },
			)
		}

		// Verify order amount matches payment amount (security check)
		if (Math.abs(order.totalAmount - amount) > 0.01) {
			console.warn('Order amount mismatch:', {
				orderId,
				orderAmount: order.totalAmount,
				paymentAmount: amount,
			})
			return NextResponse.json(
				{
					error: 'Amount mismatch',
					message: 'Payment amount does not match order total. Please refresh the page.',
				},
				{ status: 400 },
			)
		}

		// Create Omise PromptPay charge (following Omise standards)
		// Creates source and charge in a single API request (server-side approach)
		// This ensures we have a valid charge ID and QR code URL before updating database
		let charge
		try {
			charge = await createPromptpayCharge({
				amount,
				orderId,
				description,
			})
		} catch (chargeError: any) {
			const omiseError = chargeError?.omiseError
			const statusCode = chargeError?.statusCode
			const errorMessage = chargeError?.message || 'Failed to create payment charge'

			console.error('Error creating Omise charge:', {
				orderId,
				amount,
				error: chargeError,
				omiseError,
				statusCode,
				message: errorMessage,
			})

			// Handle amount validation errors (should be 400)
			if (errorMessage.includes('at least') || errorMessage.includes('exceed')) {
				return NextResponse.json(
					{
						error: 'Invalid amount',
						message: errorMessage,
					},
					{ status: 400 },
				)
			}

			// Handle configuration errors (missing API key, etc.) - 500
			if (errorMessage.includes('OMISE_SECRET_KEY') || errorMessage.includes('not set')) {
				return NextResponse.json(
					{
						error: 'Payment service configuration error',
						message: 'Payment service is not properly configured. Please contact support.',
					},
					{ status: 500 },
				)
			}

			// Handle Omise API error codes
			if (omiseError?.code) {
				// Authentication errors (401)
				if (statusCode === 401 || omiseError.code === 'authentication_failure') {
					return NextResponse.json(
						{
							error: 'Payment service authentication error',
							message: 'Payment service authentication failed. Please contact support.',
						},
						{ status: 500 },
					)
				}

				// Validation errors (400) - bad_request
				if (statusCode === 400 || omiseError.code === 'bad_request') {
					return NextResponse.json(
						{
							error: 'Invalid payment request',
							message: omiseError.message || errorMessage,
						},
						{ status: 400 },
					)
				}

				// Rate limiting (429)
				if (statusCode === 429 || omiseError.code === 'rate_limit') {
					return NextResponse.json(
						{
							error: 'Too many requests',
							message: 'Too many payment requests. Please wait a moment and try again.',
						},
						{ status: 429 },
					)
				}
			}

			// Other Omise API errors (network, timeout, server errors) - 500
			return NextResponse.json(
				{
					error: 'Payment creation failed',
					message: errorMessage,
					...(omiseError && { details: omiseError }),
				},
				{ status: 500 },
			)
		}

		// Validate charge response
		if (!charge || !charge.id) {
			console.error('Invalid charge response from Omise:', { charge, orderId })
			return NextResponse.json(
				{
					error: 'Invalid payment response',
					message: 'Payment service returned an invalid response. Please try again.',
				},
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
				// Same order, return existing info (idempotent response)
				return NextResponse.json({
					chargeId: charge.id,
					qrCodeUrl: existingOrderWithCharge.qrCodeUrl,
					status: 'pending', // Default status
				})
			}
			// Different order - Charge ID conflict (shouldn't happen but handle it)
			// This indicates a potential data integrity issue
			console.error('Charge ID conflict detected:', {
				chargeId: charge.id,
				requestedOrderId: orderId,
				existingOrderId: existingOrderWithCharge.id,
			})
			return NextResponse.json(
				{
					error: 'Payment creation conflict',
					message: 'This payment has already been associated with another order. Please contact support.',
					conflictField: 'omiseChargeId',
				},
				{ status: 409 }, // Conflict: resource conflict
			)
		}

		// Extract QR code URL according to Omise PromptPay documentation:
		// charge.source.scannable_code.image.download_uri
		const qrCodeUrl = charge.qr_code_url || null

		// Use updateMany with condition to atomically update only if omiseChargeId is still null
		// This prevents race conditions where multiple requests try to create payment simultaneously
		let updateResult
		try {
			updateResult = await prisma.order.updateMany({
				where: {
					id: orderId,
					omiseChargeId: null, // Only update if omiseChargeId is still null
					status: 'pending', // And status is still pending
				},
				data: {
					omiseChargeId: charge.id,
					qrCodeUrl: qrCodeUrl, // QR code URL for customer to scan
					paymentMethod: 'promptpay',
				},
			})
		} catch (dbError: any) {
			console.error('Database error updating order with charge:', {
				orderId,
				chargeId: charge.id,
				error: dbError,
				code: dbError?.code,
				message: dbError?.message,
			})

			// Handle Prisma errors
			if (dbError?.code === 'P2002') {
				// Unique constraint violation - charge ID already exists
				const existingOrder = await prisma.order.findUnique({
					where: { omiseChargeId: charge.id },
				})

				if (existingOrder?.id === orderId) {
					// Same order - idempotent, return existing data
					return NextResponse.json({
						chargeId: charge.id,
						qrCodeUrl: existingOrder.qrCodeUrl || qrCodeUrl,
						status: 'pending',
						expires_at: charge.expires_at,
					})
				}

				return NextResponse.json(
					{
						error: 'Payment creation conflict',
						message: 'This payment has already been associated with another order.',
						conflictField: 'omiseChargeId',
					},
					{ status: 409 },
				)
			}

			// Other database errors
			return NextResponse.json(
				{
					error: 'Database error',
					message: 'Failed to save payment information. Please try again.',
				},
				{ status: 500 },
			)
		}

		// If no rows were updated, another request already created the payment or order status changed
		if (updateResult.count === 0) {
			// Fetch the order again to get the current state
			const existingOrder = await prisma.order.findUnique({
				where: { id: orderId },
			})

			if (!existingOrder) {
				return NextResponse.json(
					{ error: 'Order not found' },
					{ status: 404 },
				)
			}

			// Check if order status changed (no longer pending)
			// This indicates a state conflict - order was updated by another process
			if (existingOrder.status !== 'pending') {
				return NextResponse.json(
					{
						error: 'Order state conflict',
						message: `Order status has changed to "${existingOrder.status}". Please refresh the page.`,
						currentStatus: existingOrder.status,
						conflictType: 'state_change',
					},
					{ status: 409 }, // Conflict: state conflict
				)
			}

			// If order still pending but has omiseChargeId, another request succeeded
			if (existingOrder.omiseChargeId) {
				return NextResponse.json({
					chargeId: existingOrder.omiseChargeId,
					qrCodeUrl: existingOrder.qrCodeUrl,
				})
			}

			// Order status is still pending but update failed (shouldn't happen)
			// This indicates a race condition or unexpected database state
			console.error('Unexpected update failure:', {
				orderId,
				chargeId: charge.id,
				orderStatus: existingOrder.status,
				hasChargeId: !!existingOrder.omiseChargeId,
			})
			return NextResponse.json(
				{
					error: 'Payment creation failed',
					message: 'Unable to complete payment creation. Please try again or contact support if the issue persists.',
				},
				{ status: 500 },
			)
		}

		return NextResponse.json({
			chargeId: charge.id,
			qrCodeUrl: charge.qr_code_url, // QR code URL for PromptPay payment
			status: charge.status, // Charge status: pending, successful, failed
			expires_at: charge.expires_at, // QR code expiration time (24 hours default)
		})
	} catch (error: any) {
		// Handle validation errors
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					error: 'Invalid request data',
					message: 'The provided data is invalid.',
					details: error.errors,
				},
				{ status: 400 },
			)
		}

		// Handle JSON parsing errors
		if (error instanceof SyntaxError) {
			return NextResponse.json(
				{
					error: 'Invalid request format',
					message: 'The request body is not valid JSON.',
				},
				{ status: 400 },
			)
		}

		// Handle Prisma errors
		if (error?.code) {
			console.error('Prisma error creating payment:', {
				code: error.code,
				message: error.message,
				meta: error.meta,
			})

			if (error.code === 'P2002') {
				return NextResponse.json(
					{
						error: 'Resource conflict',
						message: 'A conflict occurred while creating the payment. Please try again.',
						conflictField: error.meta?.target?.[0],
					},
					{ status: 409 },
				)
			}

			if (error.code === 'P2025') {
				return NextResponse.json(
					{
						error: 'Order not found',
						message: 'The order does not exist or has been deleted.',
					},
					{ status: 404 },
				)
			}
		}

		// Handle all other unexpected errors
		console.error('Unexpected error creating payment:', {
			error,
			message: error?.message,
			stack: error?.stack,
		})

		return NextResponse.json(
			{
				error: 'Internal server error',
				message: 'An unexpected error occurred. Please try again or contact support if the issue persists.',
			},
			{ status: 500 },
		)
	}
}

