'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Order, OrderItem, Product } from '@prisma/client'
import { ArrowRight } from 'lucide-react'

interface OrdersListProps {
	orders: (Order & {
		items: OrderItem[]
	})[]
}

const statusColors = {
	pending: 'bg-yellow-500/20 text-yellow-500',
	paid: 'bg-blue-500/20 text-blue-500',
	completed: 'bg-green-500/20 text-green-500',
	cancelled: 'bg-red-500/20 text-red-500',
}

export function OrdersList({ orders }: OrdersListProps) {
	if (orders.length === 0) {
		return (
			<div className="text-center py-12">
				<p className="text-muted-foreground">No orders found</p>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{orders.map((order) => (
				<Link key={order.id} href={`/orders/${order.id}`}>
					<Card className="hover:shadow-lg transition-shadow cursor-pointer">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Order #{order.id.slice(0, 8)}</CardTitle>
									<CardDescription>
										{formatDate(order.createdAt)}
									</CardDescription>
								</div>
								<Badge className={statusColors[order.status as keyof typeof statusColors]}>
									{order.status.toUpperCase()}
								</Badge>
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								{order.items.map((item) => {
									const productData = item.productData as any
									return (
										<div key={item.id} className="flex items-center gap-3 text-sm">
											{productData?.image && (
												<div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded">
													<Image
														src={productData.image}
														alt={productData?.name || 'Product'}
														fill
														className="object-cover"
														unoptimized
													/>
												</div>
											)}
											<div className="flex-1">
												<span className="font-medium">
													{productData?.name || 'Unknown Product'} x {item.quantity}
												</span>
											</div>
											<span className="font-semibold">{formatCurrency(item.price * item.quantity)}</span>
										</div>
									)
								})}
								<div className="flex justify-between border-t pt-2 font-bold">
									<span>Total:</span>
									<span className="text-primary">{formatCurrency(order.totalAmount)}</span>
								</div>
								{order.status === 'pending' && (
									<div className="flex items-center justify-end pt-2 text-sm text-primary">
										<Link href={`/orders/${order.id}/payment`} onClick={(e) => e.stopPropagation()}>
											Complete Payment
											<ArrowRight className="ml-1 inline h-4 w-4" />
										</Link>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</Link>
			))}
		</div>
	)
}

