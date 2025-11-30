import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getChargeStatus } from '@/lib/omise'
import { generateKey } from '@/lib/key-generator'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions)

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const searchParams = req.nextUrl.searchParams
		const orderId = searchParams.get('orderId')
		const refresh = searchParams.get('refresh') === 'true' // Force refresh from Omise

		if (!orderId) {
			return NextResponse.json(
				{ error: 'Order ID is required' },
				{ status: 400 },
			)
		}

		// Get order (refresh from database to get latest status from webhook)
		const order = await prisma.order.findUnique({
			where: { id: orderId },
		})

		if (!order) {
			return NextResponse.json({ error: 'Order not found' }, { status: 404 })
		}

		if (order.userId !== session.user.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// If order is already paid (via webhook), return immediately
		if (order.status === 'paid' || order.status === 'completed') {
			return NextResponse.json({
				status: 'paid',
				paid: true,
				orderStatus: order.status,
				source: 'database', // Status from database (likely updated by webhook)
			})
		}

		if (!order.omiseChargeId) {
			return NextResponse.json({
				status: order.status,
				paid: false,
			})
		}

		// Fallback strategy: Check Omise API when:
		// 1. refresh=true is explicitly requested
		// 2. Order is still pending (always check to ensure status is up-to-date)
		// 3. Order has been pending for more than 30 seconds (fallback for webhook delays)
		const orderAge = Date.now() - new Date(order.createdAt).getTime()
		const shouldCheckOmise = 
			refresh || 
			order.status === 'pending' ||
			(order.status === 'pending' && orderAge > 30000) // 30 seconds fallback

		let charge: {
			paid: boolean
			status: string | null
			expires_at: string | null
			source_charge_status: string | null
		} = { paid: false, status: order.status, expires_at: null, source_charge_status: null }

		if (shouldCheckOmise) {
			try {
				charge = await getChargeStatus(order.omiseChargeId)
			} catch {
				// Fallback to database status if Omise API fails
				// Don't throw - return database status instead
				charge = { paid: false, status: order.status, expires_at: null, source_charge_status: null }
			}
		}

		// Update order status if paid
		// IMPORTANT: Only process if paid === true (strict check)
		if (charge.paid === true && order.status === 'pending') {
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

		// Determine payment status
		// Check charge.paid first (most reliable from Omise API)
		// Also check charge.status for 'successful' status
		const isPaid = charge.paid === true || charge.status === 'successful'
		const finalStatus = isPaid ? 'paid' : order.status

		// Determine data source
		let dataSource = 'database'
		if (shouldCheckOmise && charge.status) {
			dataSource = refresh ? 'omise-api-refresh' : 'omise-api-fallback'
		}

		return NextResponse.json({
			status: finalStatus,
			paid: isPaid,
			orderStatus: order.status, // Include order status for additional context
			chargeStatus: charge.status || null, // Include charge status for debugging
			expires_at: charge.expires_at || null, // QR code expiration time
			source: dataSource, // Indicate data source (database, omise-api-refresh, omise-api-fallback)
		})
	} catch (error) {
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		)
	}
}

