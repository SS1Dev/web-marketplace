import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/navbar'
import { OrderDetail } from '@/components/order-detail'

export default async function OrderDetailPage({
	params,
}: {
	params: { id: string }
}) {
	const session = await getServerSession(authOptions)

	if (!session) {
		redirect('/login')
	}

	const order = await prisma.order.findUnique({
		where: { id: params.id },
	})

	if (!order) {
		redirect('/orders')
	}

	// Get order items
	const orderItems = await prisma.orderItem.findMany({
		where: { orderId: order.id },
	})

	// Get keys for this order's items
	const orderItemIds = orderItems.map((item) => item.id)
	const keys = await prisma.key.findMany({
		where: {
			orderItemId: { in: orderItemIds },
		},
	})

	// Group keys by orderItemId
	const keysByOrderItem = keys.reduce((acc, key) => {
		if (!acc[key.orderItemId]) {
			acc[key.orderItemId] = []
		}
		acc[key.orderItemId].push(key)
		return acc
	}, {} as Record<string, typeof keys>)

	// Attach keys to order items
	const orderWithKeys = {
		...order,
		items: orderItems.map((item) => ({
			...item,
			keys: keysByOrderItem[item.id] || [],
		})),
	}

	if (!orderWithKeys || (orderWithKeys.userId !== session.user.id && session.user.role !== 'admin')) {
		redirect('/orders')
	}

	return (
		<div className="min-h-screen bg-background">
			<Navbar />
			<div className="container mx-auto px-4 py-8">
				<OrderDetail order={orderWithKeys} />
			</div>
		</div>
	)
}

