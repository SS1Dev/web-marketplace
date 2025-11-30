import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cancelCharge } from '@/lib/omise'

export const dynamic = 'force-dynamic'

export async function POST(
	req: NextRequest,
	{ params }: { params: { id: string } },
) {
	try {
		const session = await getServerSession(authOptions)

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Get order
		const order = await prisma.order.findUnique({
			where: { id: params.id },
		})

		if (!order) {
			return NextResponse.json({ error: 'Order not found' }, { status: 404 })
		}

		// Check if user owns the order
		if (order.userId !== session.user.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Only allow cancellation if order is pending
		if (order.status !== 'pending') {
			return NextResponse.json(
				{ error: 'Only pending orders can be cancelled' },
				{ status: 400 },
			)
		}

		// Cancel Omise charge if it exists
		if (order.omiseChargeId) {
			try {
				await cancelCharge(order.omiseChargeId)
			} catch {
				// The charge may already be cancelled or paid
				// Still continue with order cancellation even if Omise cancel fails
			}
		}

		// Update order status to cancelled
		await prisma.order.update({
			where: { id: params.id },
			data: {
				status: 'cancelled',
			},
		})

		return NextResponse.json({ success: true, message: 'Order cancelled successfully' })
	} catch {
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		)
	}
}

