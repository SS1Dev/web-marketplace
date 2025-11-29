import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateKey, calculateExpireDate } from '@/lib/key-generator'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const generateKeySchema = z.object({
	orderId: z.string(),
	orderItemId: z.string(),
	quantity: z.number().int().min(1),
})

export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions)

		if (!session || session.user.role !== 'admin') {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { orderId, orderItemId, quantity } = generateKeySchema.parse(body)

		// Get order and order item (data is embedded, no need for include)
		const order = await prisma.order.findUnique({
			where: { id: orderId },
		})

		if (!order) {
			return NextResponse.json({ error: 'Order not found' }, { status: 404 })
		}

		const orderItems = await prisma.orderItem.findMany({
			where: { orderId },
		})

		const orderItem = orderItems.find((item) => item.id === orderItemId)
		if (!orderItem) {
			return NextResponse.json(
				{ error: 'Order item not found' },
				{ status: 404 },
			)
		}

		// Parse productData from JSON (embedded data)
		// Type assertion needed because Prisma doesn't know about embedded Json fields at compile time
		const orderItemWithData = orderItem as any
		const productData = orderItemWithData.productData || {}

		if (productData.type !== 'key') {
			return NextResponse.json(
				{ error: 'Product is not a key type' },
				{ status: 400 },
			)
		}

		// Generate keys
		const purchaseDate = new Date()
		// Don't calculate expireDate yet - it will be calculated on first activation
		// Set a placeholder date (will be updated when activated)
		const placeholderExpireDate = new Date()
		placeholderExpireDate.setFullYear(placeholderExpireDate.getFullYear() + 100)

		// Prepare embedded data
		// Type assertion needed because Prisma doesn't know about embedded Json fields at compile time
		const orderWithData = order as any
		const userData = orderWithData.userData || {}
		const orderData = {
			id: order.id,
			status: order.status,
			totalAmount: order.totalAmount,
		}
		const orderItemData = {
			id: orderItem.id,
			quantity: orderItem.quantity,
			price: orderItem.price,
		}

		const keys = []
		for (let i = 0; i < quantity; i++) {
			let keyCode = generateKey().toUpperCase()
			// Ensure uniqueness
			let existingKey = await prisma.key.findUnique({
				where: { key: keyCode },
			})
			let attempts = 0
			while (existingKey && attempts < 10) {
				keyCode = generateKey().toUpperCase()
				existingKey = await prisma.key.findUnique({
					where: { key: keyCode },
				})
				attempts++
			}
			
			if (existingKey) {
				throw new Error('Failed to generate unique key after multiple attempts')
			}

			const key = await prisma.key.create({
				data: {
					key: keyCode,
					orderId,
					orderData: orderData as any,
					orderItemId,
					orderItemData: orderItemData as any,
					productId: orderItem.productId,
					productData: productData as any,
					userId: order.userId,
					userData: userData as any,
					purchaseDate,
					expireDate: placeholderExpireDate, // Placeholder, will be updated on activation
					buyerName: userData?.name || userData?.email || null,
				} as any, // Type assertion needed for embedded Json fields
			})

			keys.push(key)
		}

		// Update order item with the first key code (for backward compatibility)
		// Only if no keys exist yet
		const existingKeys = await prisma.key.findMany({
			where: { orderItemId },
		})
		
		if (keys.length > 0 && existingKeys.length === keys.length && !orderItem.code) {
			await prisma.orderItem.update({
				where: { id: orderItemId },
				data: {
					code: keys[0].key,
				},
			})
		}

		return NextResponse.json({
			success: true,
			keys: keys.map((k) => ({
				id: k.id,
				key: k.key,
				expireDate: k.expireDate,
			})),
		})
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.errors },
				{ status: 400 },
			)
		}

		console.error('Error generating keys:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		)
	}
}

