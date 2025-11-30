import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminLayout } from '@/components/admin-layout'
import { KeysManagement } from '@/components/keys-management'

export default async function AdminKeysPage() {
	const session = await getServerSession(authOptions)

	if (!session || session.user.role !== 'admin') {
		redirect('/products')
	}

	const orders = await prisma.order.findMany({
		where: {
			status: { in: ['paid', 'completed'] },
		},
		orderBy: { createdAt: 'desc' },
	})

	// Get all order items for these orders
	const orderIds = orders.map((o) => o.id)
	const allOrderItems = await prisma.orderItem.findMany({
		where: {
			orderId: { in: orderIds },
		},
	})

	// Get all keys for these order items
	const orderItemIds = allOrderItems.map((item) => item.id)
	const allKeys = await prisma.key.findMany({
		where: {
			orderItemId: { in: orderItemIds },
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

	// Group keys by orderItemId
	const keysByOrderItem = allKeys.reduce((acc, key) => {
		if (!acc[key.orderItemId]) {
			acc[key.orderItemId] = []
		}
		acc[key.orderItemId].push(key)
		return acc
	}, {} as Record<string, typeof allKeys>)

	// Filter orders that have key products and attach items with keys
	const filteredOrders = orders
		.filter((order) => {
			const items = itemsByOrder[order.id] || []
			return items.some((item) => {
				const productData = item.productData as any
				return productData?.type === 'key'
			})
		})
		.map((order) => {
			const items = (itemsByOrder[order.id] || []).map((item) => ({
				...item,
				keys: keysByOrderItem[item.id] || [],
			}))
			return {
				...order,
				items,
			}
		})

	return (
		<AdminLayout>
			<KeysManagement orders={filteredOrders} />
		</AdminLayout>
	)
}

