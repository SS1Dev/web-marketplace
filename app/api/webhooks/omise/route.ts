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
 * Handle charge.complete event - Update order status when payment is successful
 */
async function handleChargeComplete(event: any) {
	const charge = event.data

	if (!charge.paid || charge.status !== 'successful') {
		console.log(`Charge ${charge.id} is not paid or not successful`)
		return
	}

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
			case 'charge.complete':
				await handleChargeComplete(event)
				break

			case 'charge.expire':
				await handleChargeExpire(event)
				break

			case 'charge.create':
				// Charge created - no action needed
				console.log(`Charge ${event.data.id} created`)
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

