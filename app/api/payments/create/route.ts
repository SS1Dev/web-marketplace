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

const PROMPTPAY_MIN_AMOUNT_SATANG = 2000
const PROMPTPAY_MAX_AMOUNT_SATANG = 15000000
const PROMPTPAY_MIN_AMOUNT_THB = 20.0
const PROMPTPAY_MAX_AMOUNT_THB = 150000.0
const AMOUNT_TOLERANCE = 0.01

interface ProductData {
	name?: string
}

interface OrderItemWithProductData {
	id: string
	quantity: number
	productData: ProductData | null
}

function createErrorResponse(
	error: string,
	message: string,
	status: number,
	additional?: Record<string, unknown>,
) {
	return NextResponse.json(
		{
			error,
			message,
			...additional,
		},
		{ status },
	)
}

function buildOrderDescription(orderItems: OrderItemWithProductData[], orderId: string): string {
	const productNames = orderItems.map((item) => {
		try {
			const productName =
				(item.productData as ProductData)?.name || 'Unknown Product'
			const quantity = item.quantity > 1 ? ` x${item.quantity}` : ''
			return `${productName}${quantity}`
		} catch {
			return `Item x${item.quantity || 1}`
		}
	})

	return productNames.length > 0
		? productNames.join(', ')
		: `Order #${orderId.slice(0, 8)}`
}

function validateAmount(amount: number) {
	const amountInSatang = Math.round(amount * 100)

	if (amountInSatang < PROMPTPAY_MIN_AMOUNT_SATANG) {
		return createErrorResponse(
			'Amount too low',
			`Amount must be at least THB ${PROMPTPAY_MIN_AMOUNT_THB.toFixed(2)} for PromptPay payment.`,
			400,
		)
	}

	if (amountInSatang > PROMPTPAY_MAX_AMOUNT_SATANG) {
		return createErrorResponse(
			'Amount too high',
			`Amount cannot exceed THB ${PROMPTPAY_MAX_AMOUNT_THB.toFixed(2)} for PromptPay payment.`,
			400,
		)
	}

	return null
}

function handleChargeError(chargeError: unknown) {
	const error = chargeError as {
		omiseError?: { code?: string; message?: string }
		statusCode?: number
		message?: string
	}

	const omiseError = error?.omiseError
	const statusCode = error?.statusCode
	const errorMessage = error?.message || 'Failed to create payment charge'

	if (errorMessage.includes('at least') || errorMessage.includes('exceed')) {
		return createErrorResponse('Invalid amount', errorMessage, 400)
	}

	if (errorMessage.includes('OMISE_SECRET_KEY') || errorMessage.includes('not set')) {
		return createErrorResponse(
			'Payment service configuration error',
			'Payment service is not properly configured. Please contact support.',
			500,
		)
	}

	if (omiseError?.code) {
		if (statusCode === 401 || omiseError.code === 'authentication_failure') {
			return createErrorResponse(
				'Payment service authentication error',
				'Payment service authentication failed. Please contact support.',
				500,
			)
		}

		if (statusCode === 400 || omiseError.code === 'bad_request') {
			return createErrorResponse(
				'Invalid payment request',
				omiseError.message || errorMessage,
				400,
			)
		}

		if (statusCode === 429 || omiseError.code === 'rate_limit') {
			return createErrorResponse(
				'Too many requests',
				'Too many payment requests. Please wait a moment and try again.',
				429,
			)
		}
	}

	return createErrorResponse(
		'Payment creation failed',
		errorMessage,
		500,
		omiseError ? { details: omiseError } : undefined,
	)
}

async function handleChargeIdConflict(chargeId: string, orderId: string) {
	const existingOrder = await prisma.order.findUnique({
		where: { omiseChargeId: chargeId },
	})

	if (!existingOrder) {
		return null
	}

	if (existingOrder.id === orderId) {
		return NextResponse.json({
			chargeId,
			qrCodeUrl: existingOrder.qrCodeUrl,
			status: 'pending',
		})
	}

	return createErrorResponse(
		'Payment creation conflict',
		'This payment has already been associated with another order. Please contact support.',
		409,
		{ conflictField: 'omiseChargeId' },
	)
}

async function updateOrderWithCharge(
	orderId: string,
	chargeId: string,
	qrCodeUrl: string | null,
) {
	try {
		const updateResult = await prisma.order.updateMany({
			where: {
				id: orderId,
				omiseChargeId: null,
				status: 'pending',
			},
			data: {
				omiseChargeId: chargeId,
				qrCodeUrl,
				paymentMethod: 'promptpay',
			},
		})

		return { success: true, updateResult }
	} catch (dbError: unknown) {
		const error = dbError as { code?: string; message?: string }

		if (error?.code === 'P2002') {
			const existingOrder = await prisma.order.findUnique({
				where: { omiseChargeId: chargeId },
			})

			if (existingOrder?.id === orderId) {
				return {
					success: true,
					existingOrder,
					qrCodeUrl: existingOrder.qrCodeUrl || qrCodeUrl,
				}
			}

			return {
				success: false,
				response: createErrorResponse(
					'Payment creation conflict',
					'This payment has already been associated with another order.',
					409,
					{ conflictField: 'omiseChargeId' },
				),
			}
		}

		return {
			success: false,
			response: createErrorResponse(
				'Database error',
				'Failed to save payment information. Please try again.',
				500,
			),
		}
	}
}

async function handleUpdateFailure(orderId: string, chargeId: string) {
	const existingOrder = await prisma.order.findUnique({
		where: { id: orderId },
	})

	if (!existingOrder) {
		return createErrorResponse('Order not found', '', 404)
	}

	if (existingOrder.status !== 'pending') {
		return createErrorResponse(
			'Order state conflict',
			`Order status has changed to "${existingOrder.status}". Please refresh the page.`,
			409,
			{
				currentStatus: existingOrder.status,
				conflictType: 'state_change',
			},
		)
	}

	if (existingOrder.omiseChargeId) {
		return NextResponse.json({
			chargeId: existingOrder.omiseChargeId,
			qrCodeUrl: existingOrder.qrCodeUrl,
		})
	}

	return createErrorResponse(
		'Payment creation failed',
		'Unable to complete payment creation. Please try again or contact support if the issue persists.',
		500,
	)
}

export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions)

		if (!session) {
			return createErrorResponse('Unauthorized', '', 401)
		}

		const body = await req.json()
		const { orderId, amount } = createPaymentSchema.parse(body)

		const order = await prisma.order.findUnique({
			where: { id: orderId },
		})

		if (!order) {
			return createErrorResponse('Order not found', '', 404)
		}

		if (order.userId !== session.user.id) {
			return createErrorResponse('Unauthorized', '', 401)
		}

		if (order.status !== 'pending') {
			return createErrorResponse('Order is not pending payment', '', 400)
		}

		if (order.omiseChargeId) {
			return NextResponse.json({
				chargeId: order.omiseChargeId,
				qrCodeUrl: order.qrCodeUrl,
			})
		}

		const orderItems = await prisma.orderItem.findMany({
			where: { orderId },
		})

		if (!orderItems || orderItems.length === 0) {
			return createErrorResponse(
				'Invalid order',
				'Order has no items. Please contact support.',
				400,
			)
		}

		const description = buildOrderDescription(
			orderItems as OrderItemWithProductData[],
			orderId,
		)

		const amountValidationError = validateAmount(amount)
		if (amountValidationError) {
			return amountValidationError
		}

		if (Math.abs(order.totalAmount - amount) > AMOUNT_TOLERANCE) {
			return createErrorResponse(
				'Amount mismatch',
				'Payment amount does not match order total. Please refresh the page.',
				400,
			)
		}

		let charge
		try {
			charge = await createPromptpayCharge({
				amount,
				orderId,
				description,
			})
		} catch (chargeError) {
			return handleChargeError(chargeError)
		}

		if (!charge || !charge.id) {
			return createErrorResponse(
				'Invalid payment response',
				'Payment service returned an invalid response. Please try again.',
				500,
			)
		}

		const conflictResponse = await handleChargeIdConflict(charge.id, orderId)
		if (conflictResponse) {
			return conflictResponse
		}

		const qrCodeUrl = charge.qr_code_url || null
		const updateResult = await updateOrderWithCharge(orderId, charge.id, qrCodeUrl)

		if (!updateResult.success) {
			return updateResult.response
		}

		if (updateResult.existingOrder) {
			return NextResponse.json({
				chargeId: charge.id,
				qrCodeUrl: updateResult.qrCodeUrl,
				status: 'pending',
			})
		}

		if (updateResult.updateResult && updateResult.updateResult.count === 0) {
			return handleUpdateFailure(orderId, charge.id)
		}

		return NextResponse.json({
			chargeId: charge.id,
			qrCodeUrl: charge.qr_code_url,
			status: charge.status,
			expires_at: charge.expires_at,
		})
	} catch (error: unknown) {
		if (error instanceof z.ZodError) {
			return createErrorResponse(
				'Invalid request data',
				'The provided data is invalid.',
				400,
				{ details: error.errors },
			)
		}

		if (error instanceof SyntaxError) {
			return createErrorResponse(
				'Invalid request format',
				'The request body is not valid JSON.',
				400,
			)
		}

		const prismaError = error as { code?: string; message?: string; meta?: unknown }
		if (prismaError?.code) {
			if (prismaError.code === 'P2002') {
				return createErrorResponse(
					'Resource conflict',
					'A conflict occurred while creating the payment. Please try again.',
					409,
					{
						conflictField: (prismaError.meta as { target?: string[] })?.target?.[0],
					},
				)
			}

			if (prismaError.code === 'P2025') {
				return createErrorResponse(
					'Order not found',
					'The order does not exist or has been deleted.',
					404,
				)
			}
		}

		return createErrorResponse(
			'Internal server error',
			'An unexpected error occurred. Please try again or contact support if the issue persists.',
			500,
		)
	}
}

