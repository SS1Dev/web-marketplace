import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createPromptpayCharge } from '@/lib/omise'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/**
 * Order Creation API - Following Omise PromptPay Flow
 * 
 * Flow:
 * 1. User creates order (this endpoint) - Creates order AND Omise charge simultaneously
 * 2. Order is created with omiseChargeId and qrCodeUrl immediately
 * 3. User redirected to payment page (/orders/[id]/payment) with QR code ready
 * 4. Webhook (charge.create) may update order as backup (idempotent)
 * 5. User scans QR code to pay
 * 6. Webhook (charge.complete) updates order status and generates keys
 * 
 * Important:
 * - Order is created WITH omiseChargeId from the start (integrated payment creation)
 * - This ensures order always has payment information immediately
 * - Sparse unique index on omiseChargeId allows multiple null values (though we set it immediately)
 */

const createOrderSchema = z.object({
	productId: z.string(),
	quantity: z.number().min(1),
	userId: z.string(),
})

export async function POST(req: NextRequest) {
	// Declare variables in outer scope for error handling
	let userId: string | undefined
	let productId: string | undefined
	
	try {
		const session = await getServerSession(authOptions)

		if (!session) {
			return NextResponse.json(
				{ error: 'Unauthorized', message: 'You must be logged in to create an order' },
				{ status: 401 },
			)
		}

		// Parse request body
		let body
		try {
			body = await req.json()
		} catch (parseError) {
			return NextResponse.json(
				{
					error: 'Invalid request format',
					message: 'Request body must be valid JSON',
				},
				{ status: 400 },
			)
		}

		// Validate request data
		let validatedData
		try {
			validatedData = createOrderSchema.parse(body)
		} catch (validationError) {
			if (validationError instanceof z.ZodError) {
				return NextResponse.json(
					{
						error: 'Invalid request data',
						message: 'Please check your input and try again',
						details: validationError.errors,
					},
					{ status: 400 },
				)
			}
			throw validationError
		}

		// Extract and assign to outer scope variables
		const validated = validatedData
		productId = validated.productId
		userId = validated.userId
		const { quantity } = validated

		// Verify user
		if (session.user.id !== userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Get user data
		const user = await prisma.user.findUnique({
			where: { id: userId },
		})

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		// Get product
		const product = await prisma.product.findUnique({
			where: { id: productId },
		})

		if (!product || !product.isActive) {
			return NextResponse.json(
				{ error: 'Product not found' },
				{ status: 404 },
			)
		}

		// Validate product price
		if (product.price === null || product.price === undefined || product.price < 0) {
			console.error('Invalid product price:', { productId, price: product.price })
			return NextResponse.json(
				{
					error: 'Invalid product',
					message: 'Product has an invalid price. Please contact support.',
				},
				{ status: 400 },
			)
		}

		// Check stock only for non-key products
		if (product.type !== 'key' && product.type !== 'script') {
			if (product.stock === null || product.stock === undefined || product.stock < quantity) {
				return NextResponse.json(
					{
						error: 'Insufficient stock',
						message: `Only ${product.stock || 0} items available, but ${quantity} requested`,
					},
					{ status: 400 },
				)
			}
		}

		// Prepare user data for embedding
		const userData = {
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image,
			role: user.role,
		}

		// Prepare product data for embedding
		const productData = {
			id: product.id,
			name: product.name,
			description: product.description,
			price: product.price,
			image: product.image,
			category: product.category,
			type: product.type,
			expireDays: product.expireDays,
			sourceCode: (product as any).sourceCode ?? null,
		}

		// Calculate total amount
		const totalAmount = product.price * quantity

		// Validate total amount calculation
		if (!isFinite(totalAmount) || totalAmount < 0) {
			console.error('Invalid total amount calculation:', {
				productPrice: product.price,
				quantity,
				totalAmount,
			})
			return NextResponse.json(
				{
					error: 'Invalid order amount',
					message: 'Unable to calculate order total. Please try again.',
				},
				{ status: 400 },
			)
		}

		// Validate amount against Omise PromptPay limits
		// According to Omise PromptPay documentation:
		// - Minimum: 2000 satang (THB 20.00)
		// - Maximum: 15000000 satang (THB 150,000.00)
		const amountInSatang = Math.round(totalAmount * 100)
		if (amountInSatang < 2000) {
			return NextResponse.json(
				{
					error: 'Amount too low',
					message: 'Order amount must be at least THB 20.00 for PromptPay payment.',
				},
				{ status: 400 },
			)
		}
		if (amountInSatang > 15000000) {
			return NextResponse.json(
				{
					error: 'Amount too high',
					message: 'Order amount cannot exceed THB 150,000.00 for PromptPay payment.',
				},
				{ status: 400 },
			)
		}

		// Create order first (without omiseChargeId initially)
		// We need order.id to include in Omise charge metadata
		let order
		try {
			order = await prisma.order.create({
				data: {
					userId,
					userData,
					totalAmount,
					status: 'pending',
					paymentMethod: null, // Will be set to 'promptpay' after charge creation
					// omiseChargeId will be set after charge is created
				},
			})
		} catch (orderError: any) {
			console.error('Error creating order:', {
				userId,
				productId,
				quantity,
				totalAmount,
				error: orderError,
				code: orderError?.code,
				meta: orderError?.meta,
			})

			// Re-throw to be handled by outer catch block
			throw orderError
		}

		// Create Omise PromptPay charge with orderId in metadata
		// This ensures webhook can find the order later
		let charge
		let qrCodeUrl: string | null = null

		try {
			// Build description from product name
			const description = `${product.name}${quantity > 1 ? ` x${quantity}` : ''}`

			// Create Omise PromptPay charge with orderId in metadata
			charge = await createPromptpayCharge({
				amount: totalAmount,
				orderId: order.id, // Include orderId in charge metadata for webhook reference
				description,
			})

			// Extract QR code URL according to Omise PromptPay documentation
			qrCodeUrl = charge.qr_code_url || null

			console.log('Omise charge created successfully:', {
				chargeId: charge.id,
				orderId: order.id,
				orderAmount: totalAmount,
				hasQrCode: !!qrCodeUrl,
			})
		} catch (chargeError: any) {
			console.error('Error creating Omise charge:', {
				orderId: order.id,
				userId,
				productId,
				totalAmount,
				error: chargeError,
			})

			// If charge creation fails, delete the order to maintain data integrity
			try {
				await prisma.order.delete({
					where: { id: order.id },
				})
				console.log('Order deleted after charge creation failure')
			} catch (deleteError) {
				console.error('Failed to delete order after charge creation failure:', deleteError)
			}

			// Handle Omise errors
			const errorMessage = chargeError?.message || 'Failed to create payment charge'
			
			if (errorMessage.includes('at least') || errorMessage.includes('exceed')) {
				return NextResponse.json(
					{
						error: 'Invalid amount',
						message: errorMessage,
					},
					{ status: 400 },
				)
			}

			return NextResponse.json(
				{
					error: 'Payment creation failed',
					message: errorMessage,
				},
				{ status: 500 },
			)
		}

		// Update order with omiseChargeId and QR code URL
		// Since order was just created, use direct update (simpler and more reliable)
		let updatedOrder
		try {
			// Use direct update instead of updateMany
			// The order was just created so it's safe to update directly
			updatedOrder = await prisma.order.update({
				where: { id: order.id },
				data: {
					omiseChargeId: charge.id,
					qrCodeUrl: qrCodeUrl,
					paymentMethod: 'promptpay',
				},
			})

			console.log('Order updated with payment information:', {
				orderId: updatedOrder.id,
				chargeId: updatedOrder.omiseChargeId,
				hasQrCode: !!updatedOrder.qrCodeUrl,
			})
		} catch (updateError: any) {
			// If update fails (e.g., unique constraint violation from concurrent request),
			// fetch current state and verify
			console.warn('Direct update failed, checking current order state:', {
				orderId: order.id,
				chargeId: charge.id,
				error: updateError?.message,
			})

			try {
				// Fetch current order state
				const currentOrder = await prisma.order.findUnique({
					where: { id: order.id },
				})

				if (!currentOrder) {
					throw new Error('Order not found')
				}

				// Check if omiseChargeId is already set (maybe by concurrent request or webhook)
				if (currentOrder.omiseChargeId) {
					if (currentOrder.omiseChargeId === charge.id) {
						// Already set correctly - use current order
						updatedOrder = currentOrder
						console.log('Order already has correct omiseChargeId (possibly set by concurrent request/webhook)')
					} else {
						// Different charge ID - this is unexpected
						console.error('Order already has different omiseChargeId:', {
							orderId: order.id,
							existingChargeId: currentOrder.omiseChargeId,
							newChargeId: charge.id,
						})
						
						// Still use current order but log the issue
						// The charge was created, so we'll return success
						// This could be a race condition - webhook may have set a different charge
						updatedOrder = currentOrder
						console.warn('Order has different omiseChargeId, but proceeding with existing value')
					}
				} else {
					// Order doesn't have omiseChargeId yet - try updateMany as fallback
					const updateResult = await prisma.order.updateMany({
						where: {
							id: order.id,
						},
						data: {
							omiseChargeId: charge.id,
							qrCodeUrl: qrCodeUrl,
							paymentMethod: 'promptpay',
						},
					})

					if (updateResult.count > 0) {
						// UpdateMany succeeded
						const fetchedOrder = await prisma.order.findUnique({
							where: { id: order.id },
						})
						
						if (fetchedOrder) {
							updatedOrder = fetchedOrder
							console.log('Order update succeeded using updateMany fallback')
						} else {
							throw new Error('Order not found after updateMany')
						}
					} else {
						// UpdateMany also failed - throw original error
						throw updateError
					}
				}
			} catch (fallbackError: any) {
				console.error('All update attempts failed:', {
					orderId: order.id,
					chargeId: charge.id,
					originalError: updateError?.message,
					fallbackError: fallbackError?.message,
				})

				// If all updates fail, we still have the order and charge
				// Webhook will handle updating the order later
				// For now, return the order as-is (without omiseChargeId)
				// The charge was created successfully, so user can still pay
				console.warn('Failed to update order with omiseChargeId, but charge was created. Webhook will handle this.')
				updatedOrder = order // Use original order - webhook will update it
			}
		}

		// Ensure we have an updated order
		if (!updatedOrder) {
			// Final fallback - fetch order again
			updatedOrder = await prisma.order.findUnique({
				where: { id: order.id },
			})

			if (!updatedOrder) {
				throw new Error('Failed to retrieve order after update attempts')
			}
		}

		// Create order item separately (no relation)
		try {
			await prisma.orderItem.create({
				data: {
					orderId: order.id,
					productId,
					productData,
					quantity,
					price: product.price,
				},
			})
		} catch (itemError: any) {
			// If order item creation fails, we should delete the order to maintain data integrity
			console.error('Error creating order item, attempting to clean up order:', {
				orderId: order.id,
				error: itemError,
			})

			try {
				await prisma.order.delete({
					where: { id: order.id },
				})
			} catch (deleteError) {
				console.error('Failed to clean up order after item creation failure:', deleteError)
			}

			// Re-throw to be handled by outer catch block
			throw itemError
		}

		// Return order information with payment details
		// Order is created with omiseChargeId and QR code URL
		return NextResponse.json({
			orderId: updatedOrder.id,
			status: updatedOrder.status,
			totalAmount: updatedOrder.totalAmount,
			chargeId: updatedOrder.omiseChargeId,
			qrCodeUrl: updatedOrder.qrCodeUrl,
			expires_at: charge.expires_at, // QR code expiration time
		})
	} catch (error: any) {
		// Handle validation errors (already handled above, but keep for safety)
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					error: 'Invalid request data',
					message: 'Please check your input and try again',
					details: error.errors,
				},
				{ status: 400 },
			)
		}

		// Handle Prisma unique constraint violations (P2002)
		// According to HTTP standards: 409 Conflict should be used for resource conflicts
		if (error?.code === 'P2002') {
			const target = error?.meta?.target as string | string[] | undefined
			// target can be a string (constraint name) or array of field names
			let field = 'unknown'
			
			if (Array.isArray(target)) {
				field = target[0] || 'unknown'
			} else if (typeof target === 'string') {
				// Parse constraint name like "orders_omiseChargeId_key" to get field name
				// Format is usually: "{table}_{field}_key"
				const match = target.match(/orders_(\w+)_key/)
				if (match) {
					field = match[1]
				} else {
					field = target
				}
			}

			console.error('Unique constraint violation when creating order:', {
				code: error.code,
				target,
				field,
				meta: error.meta,
				error: error.message,
			})

			// Determine appropriate error message and status based on the conflicted field
			if (field === 'omiseChargeId') {
				// This is a rare case - unique constraint on null/undefined omiseChargeId
				// This can happen in MongoDB if there's a data integrity issue
				// Try to handle gracefully
				console.error('Unique constraint violation on omiseChargeId for new order - this should not happen', {
					userId: userId || 'unknown',
					productId: productId || 'unknown',
				})

				return NextResponse.json(
					{
						error: 'Order creation conflict',
						message: 'Unable to create order due to a database constraint. Please try again. If the problem persists, please contact support.',
						conflictField: 'omiseChargeId',
					},
					{ status: 409 }, // Conflict: resource state conflict
				)
			}

			// For other unique constraint violations (shouldn't happen with current schema)
			return NextResponse.json(
				{
					error: 'Order creation conflict',
					message: 'Unable to create order due to a conflict. Please try again.',
					conflictField: field,
				},
				{ status: 409 }, // Conflict: resource conflict
			)
		}

		// Handle other Prisma errors
		if (error?.code) {
			console.error('Prisma error when creating order:', {
				code: error.code,
				message: error.message,
				meta: error.meta,
			})

			// Handle foreign key constraint violations (P2003)
			if (error.code === 'P2003') {
				const field = error.meta?.field_name || 'unknown'
				return NextResponse.json(
					{
						error: 'Invalid reference',
						message: `The ${field} you specified does not exist.`,
					},
					{ status: 400 }, // Bad Request: invalid data
				)
			}

			// Handle record not found (P2025)
			if (error.code === 'P2025') {
				return NextResponse.json(
					{
						error: 'Resource not found',
						message: 'One or more referenced resources were not found.',
					},
					{ status: 404 },
				)
			}

			// Handle database connection errors
			if (error.code === 'P1001' || error.code === 'P1017') {
				return NextResponse.json(
					{
						error: 'Database connection error',
						message: 'Unable to connect to the database. Please try again later.',
					},
					{ status: 503 }, // Service Unavailable
				)
			}
		}

		// Handle JSON parsing errors (should be caught above, but keep for safety)
		if (error instanceof SyntaxError) {
			return NextResponse.json(
				{
					error: 'Invalid request format',
					message: 'Request body must be valid JSON',
				},
				{ status: 400 },
			)
		}

		// Handle all other errors as internal server errors
		console.error('Unexpected error creating order:', {
			error,
			message: error?.message,
			stack: error?.stack,
		})
		return NextResponse.json(
			{
				error: 'Internal server error',
				message: 'An unexpected error occurred while creating your order. Please try again or contact support if the problem persists.',
			},
			{ status: 500 },
		)
	}
}

