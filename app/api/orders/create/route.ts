import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createOrderSchema = z.object({
	productId: z.string(),
	quantity: z.number().min(1),
	userId: z.string(),
})

export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions)

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { productId, quantity, userId } = createOrderSchema.parse(body)

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

		// Check stock only for non-key products
		if (product.type !== 'key' && product.stock < quantity) {
			return NextResponse.json(
				{ error: 'Insufficient stock' },
				{ status: 400 },
			)
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

		// Create order (omiseChargeId will be null initially, set later when payment is created)
		// Don't explicitly set omiseChargeId to avoid unique constraint issues with null values
		const order = await prisma.order.create({
			data: {
				userId,
				userData,
				totalAmount: product.price * quantity,
				status: 'pending',
				// omiseChargeId will default to null from schema
			},
		})

		// Create order item separately (no relation)
		await prisma.orderItem.create({
			data: {
				orderId: order.id,
				productId,
				productData,
				quantity,
				price: product.price,
			},
		})

		return NextResponse.json({ orderId: order.id })
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.errors },
				{ status: 400 },
			)
		}

		// Handle unique constraint violations
		if (error?.code === 'P2002') {
			console.error('Unique constraint violation when creating order:', error)
			// If it's a unique constraint on omiseChargeId, it shouldn't happen for new orders
			// But handle it gracefully anyway
			if (error?.meta?.target?.includes('omiseChargeId')) {
				return NextResponse.json(
					{ error: 'Order creation conflict. Please try again.' },
					{ status: 409 },
				)
			}
		}

		console.error('Error creating order:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		)
	}
}

