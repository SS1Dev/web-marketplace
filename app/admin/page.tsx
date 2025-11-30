import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminLayout } from '@/components/admin-layout'
import { AdminDashboard } from '@/components/admin-dashboard'

export default async function AdminPage() {
	const session = await getServerSession(authOptions)

	if (!session || session.user.role !== 'admin') {
		redirect('/products')
	}

	// นับเฉพาะคำสั่งซื้อที่ชำระเงินแล้ว (paid/completed)
	const [
		totalOrders,
		totalRevenue,
		pendingOrders,
		recentOrders,
	] = await Promise.all([
		prisma.order.count({
			where: { status: { in: ['paid', 'completed'] } },
		}),
		prisma.order.aggregate({
			where: { status: { in: ['paid', 'completed'] } },
			_sum: { totalAmount: true },
		}),
		prisma.order.count({ where: { status: 'pending' } }),
		prisma.order.findMany({
			where: { status: { in: ['paid', 'completed'] } },
			take: 10,
			orderBy: { createdAt: 'desc' },
		}),
	])

	// ใช้เฉพาะ order ที่ชำระเงินแล้วสำหรับ Top Products
	const paidOrderIds = await prisma.order.findMany({
		where: { status: { in: ['paid', 'completed'] } },
		select: { id: true },
	})

	const paidOrderIdList = paidOrderIds.map((o) => o.id)

	const topProducts = await prisma.orderItem.groupBy({
		by: ['productId'],
		where: {
			orderId: { in: paidOrderIdList },
		},
		_sum: { quantity: true },
		orderBy: { _sum: { quantity: 'desc' } },
		take: 5,
	})

	// Get order items for recent orders
	const recentOrderIds = recentOrders.map((o) => o.id)
	const recentOrderItems = await prisma.orderItem.findMany({
		where: {
			orderId: { in: recentOrderIds },
		},
	})

	// Group order items by orderId
	const itemsByOrder = recentOrderItems.reduce((acc, item) => {
		if (!acc[item.orderId]) {
			acc[item.orderId] = []
		}
		acc[item.orderId].push(item)
		return acc
	}, {} as Record<string, typeof recentOrderItems>)

	// Attach items to recent orders
	const recentOrdersWithItems = recentOrders.map((order) => ({
		...order,
		items: itemsByOrder[order.id] || [],
	}))

	const topProductsWithDetails = await Promise.all(
		topProducts.map(async (item) => {
			const product = await prisma.product.findUnique({
				where: { id: item.productId },
			})
			return {
				product,
				quantity: item._sum.quantity || 0,
			}
		}),
	)

	return (
		<AdminLayout>
			<AdminDashboard
				totalOrders={totalOrders}
				totalRevenue={totalRevenue._sum.totalAmount || 0}
				pendingOrders={pendingOrders}
				recentOrders={recentOrdersWithItems}
				topProducts={topProductsWithDetails}
			/>
		</AdminLayout>
	)
}

