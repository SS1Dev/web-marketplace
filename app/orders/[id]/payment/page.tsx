import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/navbar'
import { PaymentPage } from '@/components/payment-page'

export default async function OrderPaymentPage({
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

	if (!order || order.userId !== session.user.id) {
		redirect('/orders')
	}

	if (order.status === 'paid' || order.status === 'completed' || order.status === 'cancelled') {
		redirect(`/orders/${order.id}`)
	}

	// Get order items
	const orderItems = await prisma.orderItem.findMany({
		where: { orderId: order.id },
	})

	// Attach items to order
	const orderWithItems = {
		...order,
		items: orderItems,
	}

	return (
		<div className="min-h-screen bg-background">
			<Navbar />
			<div className="container mx-auto px-4 py-8">
				<PaymentPage order={orderWithItems} />
			</div>
		</div>
	)
}

