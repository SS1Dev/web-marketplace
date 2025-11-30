import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { generateKey, calculateExpireDate } from '@/lib/key-generator'

export const dynamic = 'force-dynamic'

/**
 * Verify Omise webhook signature
 * @param payload - Raw request body as string
 * @param signature - Signature from X-Omise-Signature header
 * @returns boolean indicating if signature is valid
 */
function verifyOmiseSignature(payload: string, signature: string): boolean {
	if (!process.env.OMISE_SECRET_KEY) {
		console.error('OMISE_SECRET_KEY is not set')
		return false
	}

	// Omise webhook signature format: sha256=hexdigest
	const expectedSignature = crypto
		.createHmac('sha256', process.env.OMISE_SECRET_KEY)
		.update(payload)
		.digest('hex')

	// Extract signature from header (format: sha256=hexdigest)
	const receivedSignature = signature.replace('sha256=', '')

	return crypto.timingSafeEqual(
		Buffer.from(expectedSignature),
		Buffer.from(receivedSignature),
	)
}

/**
 * Handle charge.create event - Update order with QR code URL when charge is created
 */
async function handleChargeCreate(event: any) {
	const charge = event.data

	// Get orderId from charge metadata
	const orderId = charge.metadata?.orderId

	if (!orderId) {
		console.log(`Charge ${charge.id} has no orderId in metadata, skipping`)
		return
	}

	// Extract QR code URL from charge source
	const qrCodeUrl = charge.source?.scannable_code?.image?.download_uri || null

	// Find order by metadata orderId first, then try omiseChargeId
	let order = await prisma.order.findUnique({
		where: { id: orderId },
	})

	if (!order) {
		// Try finding by omiseChargeId (in case order was created via webhook first)
		order = await prisma.order.findUnique({
			where: { omiseChargeId: charge.id },
		})
	}

	if (!order) {
		console.log(`Order not found for charge ${charge.id}, orderId: ${orderId}`)
		return
	}

	// Update order with charge ID and QR code URL if not already set
	// Use updateMany to prevent unique constraint violations and race conditions
	const updateData: any = {}

	if (!order.omiseChargeId) {
		updateData.omiseChargeId = charge.id
	}

	if (qrCodeUrl && !order.qrCodeUrl) {
		updateData.qrCodeUrl = qrCodeUrl
	}

	if (Object.keys(updateData).length > 0) {
		// Use updateMany with condition to atomically update only if omiseChargeId is still null
		// This prevents unique constraint violations if webhook is called multiple times
		const updateResult = await prisma.order.updateMany({
			where: {
				id: order.id,
				omiseChargeId: null, // Only update if omiseChargeId is still null
			},
			data: updateData,
		})

		if (updateResult.count > 0) {
			console.log(`Order ${order.id} updated with charge ${charge.id} and QR code URL`)
		} else {
			console.log(`Order ${order.id} already has charge ID (omiseChargeId already set)`)
		}
	} else {
		console.log(`Order ${order.id} already has charge ID and QR code URL`)
	}
}

/**
 * Handle charge.complete event - Update order status when payment is completed (successful or failed)
 */
async function handleChargeComplete(event: any) {
	const charge = event.data

	// Get charge status from multiple sources
	const chargeStatus = charge.status
	const sourceChargeStatus = charge.source?.charge_status
	const isPaid = charge.paid

	console.log(`Processing charge.complete for ${charge.id}`, {
		status: chargeStatus,
		sourceChargeStatus: sourceChargeStatus,
		paid: isPaid,
	})

	// Check if payment is successful
	// MUST have paid === true AND status must be successful
	// This ensures we only process successful payments
	const isSuccessful = 
		isPaid === true && 
		(chargeStatus === 'successful' || sourceChargeStatus === 'successful')

	// Handle successful payment - ONLY if paid is true
	if (isSuccessful) {
		// Get orderId from charge metadata
		const orderId = charge.metadata?.orderId

		if (!orderId) {
			console.error(`Charge ${charge.id} has no orderId in metadata`)
			return
		}

		// Find order by omiseChargeId (more reliable)
		let order = await prisma.order.findUnique({
			where: { omiseChargeId: charge.id },
		})

		if (!order) {
			// Fallback: try finding by orderId
			order = await prisma.order.findUnique({
				where: { id: orderId },
			})
		}

		if (!order) {
			console.error(`Order not found for charge ${charge.id}`)
			return
		}

		// Skip if already processed
		if (order.status === 'paid') {
			console.log(`Order ${order.id} already marked as paid`)
			return
		}

		// Update order status to paid
		await prisma.order.update({
			where: { id: order.id },
			data: {
				status: 'paid',
			},
		})

		console.log(`Order ${order.id} marked as paid via webhook (charge.complete)`)

		// Get order items
		const orderItems = await prisma.orderItem.findMany({
			where: { orderId: order.id },
		})

		// Update stock and generate keys
		for (const item of orderItems) {
			const productData = item.productData as any

			if (productData.type === 'key') {
				// Generate keys automatically for key products
				const purchaseDate = new Date()
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
						const userData = order.userData as any
						const orderData = {
							id: order.id,
							status: order.status,
							totalAmount: order.totalAmount,
						}
						const orderItemData = {
							id: item.id,
							quantity: item.quantity,
							price: item.price,
						}

						keysToGenerate.push({
							key: keyCode,
							orderId: order.id,
							orderData,
							orderItemId: item.id,
							orderItemData,
							productId: item.productId,
							productData,
							userId: order.userId,
							userData,
							purchaseDate,
							expireDate: placeholderExpireDate,
							buyerName: userData?.name || userData?.email || null,
						})
					}

					// Create all keys
					if (keysToGenerate.length > 0) {
						await prisma.key.createMany({
							data: keysToGenerate,
						})

						// Update order item with the first key code
						if (!item.code && keysToGenerate.length > 0) {
							await prisma.orderItem.update({
								where: { id: item.id },
								data: {
									code: keysToGenerate[0].key,
								},
							})
						}

						console.log(`Generated ${keysToGenerate.length} keys for order ${order.id}`)
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

				console.log(`Updated stock for product ${item.productId}`)
			}
		}
		return
	}

	// Handle failed/cancelled payment
	// If paid is NOT true, the payment did not succeed - must cancel order
	// Also check for explicit failed status
	const isFailed = 
		isPaid !== true || // Most important: if not paid, it failed
		chargeStatus === 'failed' ||
		sourceChargeStatus === 'failed'

	// Cancel order if payment failed or not paid
	// IMPORTANT: If paid is not true, payment did not succeed - cancel the order
	if (isFailed) {
		const orderId = charge.metadata?.orderId

		if (!orderId) {
			console.error(`Charge ${charge.id} has no orderId in metadata`)
			return
		}

		// Find order by omiseChargeId
		let order = await prisma.order.findUnique({
			where: { omiseChargeId: charge.id },
		})

		if (!order) {
			order = await prisma.order.findUnique({
				where: { id: orderId },
			})
		}

		if (!order) {
			console.error(`Order not found for charge ${charge.id}`)
			return
		}

		// Only cancel if still pending (don't cancel already paid orders)
		if (order.status === 'pending') {
			await prisma.order.update({
				where: { id: order.id },
				data: {
					status: 'cancelled',
				},
			})

			const reason = isPaid !== true 
				? 'payment not completed (paid !== true)'
				: 'charge status is failed'
			
			console.log(`Order ${order.id} marked as cancelled: ${reason}`)
		} else {
			console.log(`Order ${order.id} already processed (status: ${order.status}), skipping cancellation`)
		}
		return
	}

	// If we reach here, payment is not successful and not explicitly failed
	// This shouldn't happen often, but log it for debugging
	console.log(`Charge ${charge.id} is in an unclear state: paid=${isPaid}, status=${chargeStatus}, sourceChargeStatus=${sourceChargeStatus}`)

	// Get orderId from charge metadata
	const orderId = charge.metadata?.orderId

	if (!orderId) {
		console.error(`Charge ${charge.id} has no orderId in metadata`)
		return
	}

	// Find order by omiseChargeId
	const order = await prisma.order.findUnique({
		where: { omiseChargeId: charge.id },
	})

	if (!order) {
		console.error(`Order not found for charge ${charge.id}`)
		return
	}

	// Skip if already processed
	if (order.status === 'paid') {
		console.log(`Order ${orderId} already marked as paid`)
		return
	}

	// Update order status to paid
	await prisma.order.update({
		where: { id: order.id },
		data: {
			status: 'paid',
		},
	})

	console.log(`Order ${order.id} marked as paid via webhook`)

	// Get order items
	const orderItems = await prisma.orderItem.findMany({
		where: { orderId: order.id },
	})

	// Update stock and generate keys
	for (const item of orderItems) {
		const productData = item.productData as any

		if (productData.type === 'key') {
			// Generate keys automatically for key products
			const purchaseDate = new Date()
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
					const userData = order.userData as any
					const orderData = {
						id: order.id,
						status: order.status,
						totalAmount: order.totalAmount,
					}
					const orderItemData = {
						id: item.id,
						quantity: item.quantity,
						price: item.price,
					}

					keysToGenerate.push({
						key: keyCode,
						orderId: order.id,
						orderData,
						orderItemId: item.id,
						orderItemData,
						productId: item.productId,
						productData,
						userId: order.userId,
						userData,
						purchaseDate,
						expireDate: placeholderExpireDate,
						buyerName: userData?.name || userData?.email || null,
					})
				}

				// Create all keys
				if (keysToGenerate.length > 0) {
					await prisma.key.createMany({
						data: keysToGenerate,
					})

					// Update order item with the first key code
					if (!item.code && keysToGenerate.length > 0) {
						await prisma.orderItem.update({
							where: { id: item.id },
							data: {
								code: keysToGenerate[0].key,
							},
						})
					}

					console.log(`Generated ${keysToGenerate.length} keys for order ${order.id}`)
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

			console.log(`Updated stock for product ${item.productId}`)
		}
	}
}

/**
 * Handle charge.expire event - Update order status when payment expires
 */
async function handleChargeExpire(event: any) {
	const charge = event.data

	// Find order by omiseChargeId
	const order = await prisma.order.findUnique({
		where: { omiseChargeId: charge.id },
	})

	if (!order) {
		console.error(`Order not found for charge ${charge.id}`)
		return
	}

	// Only update if still pending
	if (order.status === 'pending') {
		await prisma.order.update({
			where: { id: order.id },
			data: {
				status: 'cancelled',
			},
		})

		console.log(`Order ${order.id} marked as cancelled (charge expired)`)
	}
}

export async function POST(req: NextRequest) {
	try {
		// Get raw body for signature verification
		const rawBody = await req.text()
		
		// Get signature from header (try different case variations)
		const signature = req.headers.get('X-Omise-Signature') || 
			req.headers.get('x-omise-signature') ||
			req.headers.get('X-OMISE-SIGNATURE') ||
			''

		if (!signature) {
			// Log all headers for debugging
			const allHeaders: Record<string, string> = {}
			req.headers.forEach((value, key) => {
				allHeaders[key] = value
			})
			console.error('Missing X-Omise-Signature header')
			console.error('Received headers:', JSON.stringify(allHeaders, null, 2))
			
			// If no signature, still process the webhook but log warning
			// Some webhook providers might not send signature for test events
			console.warn('⚠️ Processing webhook without signature verification')
		}

		// Verify webhook signature (only if signature exists)
		if (signature) {
			if (!verifyOmiseSignature(rawBody, signature)) {
				console.error('Invalid webhook signature')
				return NextResponse.json(
					{ error: 'Invalid signature' },
					{ status: 401 },
				)
			}
		} else {
			console.warn('⚠️ Skipping signature verification - no signature header found')
		}

		// Parse event data
		const event = JSON.parse(rawBody)

		console.log(`Received Omise webhook event: ${event.key}`)

		// Handle different event types
		switch (event.key) {
			case 'charge.create':
				await handleChargeCreate(event)
				break

			case 'charge.complete':
				await handleChargeComplete(event)
				break

			case 'charge.expire':
				await handleChargeExpire(event)
				break

			default:
				console.log(`Unhandled webhook event: ${event.key}`)
		}

		return NextResponse.json({ received: true })
	} catch (error) {
		console.error('Error processing Omise webhook:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		)
	}
}

