import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateProfileSchema = z.object({
	name: z.string().min(1).optional(),
	currentPassword: z.string().optional(),
	newPassword: z.string().min(6).optional(),
})

export async function PUT(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions)

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const validatedData = updateProfileSchema.parse(body)

		// Get current user
		const user = await prisma.user.findUnique({
			where: { id: session.user.id },
		})

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		const updateData: any = {}

		// Update name if provided
		if (validatedData.name !== undefined) {
			updateData.name = validatedData.name
		}

		// Update password if provided
		if (validatedData.newPassword) {
			if (!validatedData.currentPassword) {
				return NextResponse.json(
					{ error: 'Current password is required to change password' },
					{ status: 400 },
				)
			}

			// Verify current password (only for users with password)
			if (user.password) {
				const isValid = await bcrypt.compare(
					validatedData.currentPassword,
					user.password,
				)

				if (!isValid) {
					return NextResponse.json(
						{ error: 'Current password is incorrect' },
						{ status: 400 },
					)
				}
			}

			// Hash new password
			updateData.password = await bcrypt.hash(validatedData.newPassword, 10)
		}

		// Update user
		const updatedUser = await prisma.user.update({
			where: { id: session.user.id },
			data: updateData,
		})

		return NextResponse.json({
			success: true,
			user: {
				id: updatedUser.id,
				email: updatedUser.email,
				name: updatedUser.name,
			},
		})
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.errors },
				{ status: 400 },
			)
		}

		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		)
	}
}

