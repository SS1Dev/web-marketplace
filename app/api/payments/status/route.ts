import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getChargeStatus } from '@/lib/omise'
import { generateKey, calculateExpireDate } from '@/lib/key-generator'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions)

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const searchParams = req.nextUrl.searchParams
		const orderId = searchParams.get('orderId')

		if (!orderId) {
			return NextResponse.json(
				{ error: 'Order ID is required' },
				{ status: 400 },
			)
		}

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

		if (!order.omiseChargeId) {
			return NextResponse.json({
				status: order.status,
				paid: false,
			})
		}

		// Check Omise charge status
		const charge = await getChargeStatus(order.omiseChargeId)

		// Update order status if paid
		if (charge.paid && order.status === 'pending') {
			await prisma.order.update({
				where: { id: orderId },
				data: {
					status: 'paid',
				},
			})

			// Get order (userData is already embedded)
			const orderWithData = await prisma.order.findUnique({
				where: { id: orderId },
			})

			if (!orderWithData) {
				return NextResponse.json({ error: 'Order not found' }, { status: 404 })
			}

			// Update stock (only for non-key products) and generate keys
			const orderItems = await prisma.orderItem.findMany({
				where: { orderId },
			})

			for (const item of orderItems) {
				// Parse productData from JSON
				const productData = item.productData as any

				if (productData.type === 'key') {
					// Generate keys automatically for key products
					const purchaseDate = new Date()
					// Don't calculate expireDate yet - it will be calculated on first activation
					// Set a placeholder date (will be updated when activated)
					const placeholderExpireDate = new Date()
					placeholderExpireDate.setFullYear(placeholderExpireDate.getFullYear() + 100)

					// Check if keys already exist for this order item
					const existingKeys = await prisma.key.findMany({
						where: { orderItemId: item.id },
					})

					// Only generate if no keys exist yet
					if (existingKeys.length === 0) {
						const keysToGenerate = []
						
						for (let i = 0; i < item.quantity; i++) {
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
								console.error(
									`Failed to generate unique key for order item ${item.id} after multiple attempts`,
								)
								continue
							}

							// Prepare embedded data
							const userData = orderWithData.userData as any
							const orderData = {
								id: orderWithData.id,
								status: orderWithData.status,
								totalAmount: orderWithData.totalAmount,
							}
							const orderItemData = {
								id: item.id,
								quantity: item.quantity,
								price: item.price,
							}

							keysToGenerate.push({
								key: keyCode,
								orderId,
								orderData,
								orderItemId: item.id,
								orderItemData,
								productId: item.productId,
								productData,
								userId: orderWithData.userId,
								userData,
								purchaseDate,
								expireDate: placeholderExpireDate, // Placeholder, will be updated on activation
								buyerName: userData?.name || userData?.email || null,
							})
						}

						// Create all keys
						if (keysToGenerate.length > 0) {
							await prisma.key.createMany({
								data: keysToGenerate,
							})

							// Update order item with the first key code (for backward compatibility)
							if (!item.code && keysToGenerate.length > 0) {
								await prisma.orderItem.update({
									where: { id: item.id },
									data: {
										code: keysToGenerate[0].key,
									},
								})
							}
						}
					}
				} else {
					// Update stock for non-key products
					await prisma.product.update({
						where: { id: item.productId },
						data: {
							stock: {
								decrement: item.quantity,
							},
						},
					})
				}
			}
		}

		return NextResponse.json({
			status: charge.paid ? 'paid' : order.status,
			paid: charge.paid,
		})
	} catch (error) {
		console.error('Error checking payment status:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		)
	}
}

