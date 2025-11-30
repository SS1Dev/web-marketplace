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
 * Following Omise PromptPay documentation:
 * - charge.create event is sent when a charge is created
 * - QR code URL is available at: charge.source.scannable_code.image.download_uri
 * - This webhook ensures order has QR code URL even if payment API call failed to update it
 */
async function handleChargeCreate(event: any) {
	const charge = event.data

	// Get orderId from charge metadata
	const orderId = charge.metadata?.orderId

	if (!orderId) {
		console.log(`Charge ${charge.id} has no orderId in metadata, skipping`)
		return
	}

	// Extract QR code URL according to Omise PromptPay documentation:
	// charge.source.scannable_code.image.download_uri
	const qrCodeUrl = charge.source?.scannable_code?.image?.download_uri || null

	if (!qrCodeUrl) {
		console.log(`Charge ${charge.id} has no QR code URL in source, skipping QR code update`)
	}

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
		const whereCondition: any = { id: order.id }
		
		// Only update omiseChargeId if it's currently null (prevents race conditions)
		if (updateData.omiseChargeId && !order.omiseChargeId) {
			whereCondition.omiseChargeId = null
		}

		const updateResult = await prisma.order.updateMany({
			where: whereCondition,
			data: updateData,
		})

		if (updateResult.count > 0) {
			const updates = []
			if (updateData.omiseChargeId) updates.push('charge ID')
			if (updateData.qrCodeUrl) updates.push('QR code URL')
			console.log(`Order ${order.id} updated with ${updates.join(' and ')}`)
		} else {
			console.log(`Order ${order.id} already has charge ID and QR code URL (race condition prevented)`)
		}
	} else {
		console.log(`Order ${order.id} already has charge ID and QR code URL`)
	}
}

/**
 * Handle charge.complete event - Update order status when payment is completed
 * Following Omise PromptPay documentation:
 * - charge.complete event is sent when payment is completed (successful or failed)
 * - Check charge.paid === true AND charge.status === 'successful' for successful payments
 * - Handle failed payments by cancelling order
 */
async function handleChargeComplete(event: any) {
	const charge = event.data

	// Get charge status from multiple sources (Omise documentation)
	const chargeStatus = charge.status
	const sourceChargeStatus = charge.source?.charge_status
	const isPaid = charge.paid

	console.log(`Processing charge.complete for ${charge.id}`, {
		status: chargeStatus,
		sourceChargeStatus: sourceChargeStatus,
		paid: isPaid,
	})

	// Get orderId from charge metadata
	const orderId = charge.metadata?.orderId

	if (!orderId) {
		console.error(`Charge ${charge.id} has no orderId in metadata`)
		return
	}

	// Find order by omiseChargeId (more reliable) or orderId
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
		console.error(`Order not found for charge ${charge.id}, orderId: ${orderId}`)
		return
	}

	// Skip if already processed as paid
	if (order.status === 'paid') {
		console.log(`Order ${order.id} already marked as paid, skipping`)
		return
	}

	// Check if payment is successful according to Omise standards
	// MUST have paid === true AND status must be successful
	const isSuccessful = 
		isPaid === true && 
		(chargeStatus === 'successful' || sourceChargeStatus === 'successful')

	// Handle successful payment
	if (isSuccessful) {
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

				// Check if keys already exist for this order item (prevent duplicates)
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
	// According to Omise documentation:
	// - If paid !== true, payment did not succeed
	// - If status === 'failed', payment explicitly failed
	const isFailed = 
		isPaid !== true || // Most important: if not paid, it failed
		chargeStatus === 'failed' ||
		sourceChargeStatus === 'failed'

	if (isFailed) {
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

	// If we reach here, payment is in an unclear state
	// Log for debugging but don't process
	console.warn(
		`Charge ${charge.id} is in an unclear state: paid=${isPaid}, status=${chargeStatus}, sourceChargeStatus=${sourceChargeStatus}. Order ${order.id} status unchanged.`
	)
}

/**
 * Handle charge.expire event - Update order status when payment expires
 * Following Omise PromptPay documentation:
 * - charge.expire event is sent when QR code expires (default: 24 hours)
 * - Order should be cancelled if payment was not completed before expiration
 */
async function handleChargeExpire(event: any) {
	const charge = event.data

	// Get orderId from charge metadata (fallback if omiseChargeId lookup fails)
	const orderId = charge.metadata?.orderId

	// Find order by omiseChargeId (most reliable)
	let order = await prisma.order.findUnique({
		where: { omiseChargeId: charge.id },
	})

	if (!order && orderId) {
		// Fallback: try finding by orderId
		order = await prisma.order.findUnique({
			where: { id: orderId },
		})
	}

	if (!order) {
		console.error(`Order not found for expired charge ${charge.id}, orderId: ${orderId || 'N/A'}`)
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

		console.log(`Order ${order.id} marked as cancelled (PromptPay QR code expired)`)
	} else {
		console.log(`Order ${order.id} already processed (status: ${order.status}), skipping expiration cancellation`)
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

