import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

const updateProductSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().optional(),
	price: z.number().min(0).optional(),
	stock: z.number().int().min(0).optional(),
	category: z.string().optional(),
	type: z.enum(['key', 'id', 'script', 'other']).optional(),
	expireDays: z.string().optional().nullable(),
	sourceCode: z.string().optional().nullable(),
	image: z
		.union([
			z.string().url(),
			z.literal(''),
			z.null(),
		])
		.optional()
		.transform((val) => (val === '' ? null : val)),
	isActive: z.boolean().optional(),
})

export async function PUT(
	req: NextRequest,
	{ params }: { params: { id: string } },
) {
	try {
		const session = await getServerSession(authOptions)

		if (!session || session.user.role !== 'admin') {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const validatedData = updateProductSchema.parse(body)

		// Get current product to check type
		const currentProduct = await prisma.product.findUnique({
			where: { id: params.id },
		})

		if (!currentProduct) {
			return NextResponse.json({ error: 'Product not found' }, { status: 404 })
		}

		// Prepare data for Prisma, handling optional/nullable fields
		const productData: any = {}
		if (validatedData.name !== undefined) productData.name = validatedData.name
		if (validatedData.description !== undefined) productData.description = validatedData.description
		if (validatedData.price !== undefined) productData.price = validatedData.price
		if (validatedData.stock !== undefined) productData.stock = validatedData.stock
		if (validatedData.category !== undefined) productData.category = validatedData.category || null
		if (validatedData.type !== undefined) {
			productData.type = validatedData.type
			// If changing to non-key type, clear expireDays
			if (validatedData.type !== 'key') {
				productData.expireDays = null
			}
			// Only keep sourceCode if changing to script or key type
			if (validatedData.type !== 'script' && validatedData.type !== 'key') {
				productData.sourceCode = null
			}
		}
		// Only set expireDays if explicitly provided and type is 'key'
		if (validatedData.expireDays !== undefined) {
			const finalType = validatedData.type !== undefined ? validatedData.type : currentProduct.type
			if (finalType === 'key') {
				productData.expireDays = validatedData.expireDays || null
			} else {
				// Don't set expireDays for non-key types
				productData.expireDays = null
			}
		} else if (validatedData.type !== undefined && validatedData.type !== 'key') {
			// If type is being changed to non-key and expireDays is not provided, clear it
			productData.expireDays = null
		}
		// Handle sourceCode - for script or key type
		if (validatedData.sourceCode !== undefined) {
			const finalTypeForSource = validatedData.type !== undefined ? validatedData.type : currentProduct.type
			if (finalTypeForSource === 'script' || finalTypeForSource === 'key') {
				productData.sourceCode = validatedData.sourceCode || null
			} else {
				productData.sourceCode = null
			}
		} else if (validatedData.type !== undefined && validatedData.type !== 'script' && validatedData.type !== 'key') {
			productData.sourceCode = null
		}
		// If type is not being changed and expireDays is not provided, don't update it
		if (validatedData.image !== undefined) productData.image = validatedData.image || null
		if (validatedData.isActive !== undefined) productData.isActive = validatedData.isActive

		const product = await prisma.product.update({
			where: { id: params.id },
			data: productData,
		})

		// Revalidate products pages
		revalidatePath('/products')
		revalidatePath('/admin/products')

		return NextResponse.json(product)
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.errors },
				{ status: 400 },
			)
		}

		console.error('Error updating product:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		)
	}
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: { id: string } },
) {
	try {
		const session = await getServerSession(authOptions)

		if (!session || session.user.role !== 'admin') {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		await prisma.product.delete({
			where: { id: params.id },
		})

		// Revalidate products pages
		revalidatePath('/products')
		revalidatePath('/admin/products')

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('Error deleting product:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		)
	}
}

