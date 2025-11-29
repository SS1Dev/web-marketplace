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
				console.log(`Attempting to cancel Omise charge: ${order.omiseChargeId}`)
				const cancelResult = await cancelCharge(order.omiseChargeId)
				console.log(`Omise charge ${order.omiseChargeId} cancelled successfully:`, cancelResult)
			} catch (error) {
				// Log error but continue with order cancellation
				// The charge may already be cancelled or paid
				console.error(`Failed to cancel Omise charge ${order.omiseChargeId}:`, error)
				// Still continue with order cancellation even if Omise cancel fails
			}
		} else {
			console.log(`Order ${order.id} has no omiseChargeId, skipping Omise cancellation`)
		}

		// Update order status to cancelled
		await prisma.order.update({
			where: { id: params.id },
			data: {
				status: 'cancelled',
			},
		})

		return NextResponse.json({ success: true, message: 'Order cancelled successfully' })
	} catch (error) {
		console.error('Error cancelling order:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		)
	}
}

