import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createProductSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	price: z.number().min(0),
	stock: z.number().int().min(0).optional(),
	category: z.string().optional(),
	type: z.enum(['key', 'id', 'other']).default('other'),
	expireDays: z.string().optional(),
	sourceCode: z.string().optional(),
	image: z
		.union([
			z.string().url(),
			z.literal(''),
			z.null(),
		])
		.optional()
		.transform((val) => (val === '' ? null : val)),
	isActive: z.boolean(),
})

export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions)

		if (!session || session.user.role !== 'admin') {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const validatedData = createProductSchema.parse(body)

		// Prepare data for Prisma, handling optional fields
		const productData: any = {
			name: validatedData.name,
			description: validatedData.description,
			price: validatedData.price,
			stock: validatedData.stock ?? 0,
			category: validatedData.category || null,
			type: validatedData.type,
			image: validatedData.image || null,
			sourceCode: null,
			isActive: validatedData.isActive,
		}

		// Only set expireDays for 'key' type products (only if provided)
		if (validatedData.type === 'key' && validatedData.expireDays !== undefined) {
			productData.expireDays = validatedData.expireDays || null
		} else {
			productData.expireDays = null
		}

		// Only keep sourceCode for 'key' type products
		if (validatedData.type === 'key' && validatedData.sourceCode) {
			productData.sourceCode = validatedData.sourceCode
		}

		const product = await prisma.product.create({
			data: productData,
		})

		return NextResponse.json(product)
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.errors },
				{ status: 400 },
			)
		}

		console.error('Error creating product:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		)
	}
}

