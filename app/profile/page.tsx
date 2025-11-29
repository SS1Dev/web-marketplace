import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/navbar'
import { UserProfile } from '@/components/user-profile'

export default async function ProfilePage() {
	const session = await getServerSession(authOptions)

	if (!session) {
		redirect('/login')
	}

	// Get user data
	const user = await prisma.user.findUnique({
		where: { id: session.user.id },
	})

	if (!user) {
		redirect('/login')
	}

	// Get user orders
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
				<UserProfile user={user} orders={ordersWithItems} />
			</div>
		</div>
	)
}

