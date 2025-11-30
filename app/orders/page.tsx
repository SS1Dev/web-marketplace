import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/navbar'
import { OrderHistory } from '@/components/order-history'

export default async function OrdersPage() {
	const session = await getServerSession(authOptions)

	if (!session) {
		redirect('/login')
	}

	const orders = await prisma.order.findMany({
		where: { userId: session.user.id },
		orderBy: { createdAt: 'desc' },
	})

	// Get all order items for these orders
	const orderIds = orders.map((o) => o.id)
	const allOrderItems = await prisma.orderItem.findMany({
		where: {
			orderId: { in: orderIds },
		},
	})

	// Group order items by orderId
	const itemsByOrder = allOrderItems.reduce((acc, item) => {
		if (!acc[item.orderId]) {
			acc[item.orderId] = []
		}
		acc[item.orderId].push(item)
		return acc
	}, {} as Record<string, typeof allOrderItems>)

	// Attach items to orders
	const ordersWithItems = orders.map((order) => ({
		...order,
		items: itemsByOrder[order.id] || [],
	}))

	return (
		<div className="min-h-screen bg-background">
			<Navbar />
			<div className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold">My Orders</h1>
					<p className="text-muted-foreground mt-1">View and manage your order history</p>
				</div>
				<OrderHistory orders={ordersWithItems} />
			</div>
		</div>
	)
}

