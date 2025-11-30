'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Order, OrderItem, Product, User } from '@prisma/client'
import { Package, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react'

interface AdminDashboardProps {
	totalOrders: number
	totalRevenue: number
	pendingOrders: number
	recentOrders: (Order & {
		items: OrderItem[]
	})[]
	topProducts: Array<{
		product: Product | null
		quantity: number
	}>
}

export function AdminDashboard({
	totalOrders,
	totalRevenue,
	pendingOrders,
	recentOrders,
	topProducts,
}: AdminDashboardProps) {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Dashboard</h1>
					<p className="text-muted-foreground mt-1">Overview of your store performance</p>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Orders</CardTitle>
						<ShoppingCart className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{totalOrders}</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
						<DollarSign className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
						<Package className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{pendingOrders}</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
						<TrendingUp className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{totalOrders > 0
								? formatCurrency(totalRevenue / totalOrders)
								: formatCurrency(0)}
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Recent Orders</CardTitle>
						<CardDescription>Latest 10 orders</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{recentOrders.map((order) => {
								// Get first product image from order items
								const firstItem = order.items[0]
								const firstProductData = firstItem?.productData as any
								return (
									<Link
										key={order.id}
										href={`/orders/${order.id}`}
										className="block rounded-lg border p-4 hover:bg-accent transition-colors"
									>
										<div className="flex items-center gap-4">
											{firstProductData?.image && (
												<div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
													<Image
														src={firstProductData.image}
														alt={firstProductData?.name || 'Product'}
														fill
														className="object-cover"
														unoptimized
													/>
												</div>
											)}
											<div className="flex-1">
												<p className="font-semibold">
													Order #{order.id.slice(0, 8)}
												</p>
												<p className="text-sm text-muted-foreground">
													{(() => {
														const userData = order.userData as any
														return userData?.name || userData?.email || 'Unknown User'
													})()}
												</p>
												<p className="text-xs text-muted-foreground">
													{formatDate(order.createdAt)}
												</p>
											</div>
											<div className="text-right">
												<p className="font-semibold">
													{formatCurrency(order.totalAmount)}
												</p>
												<Badge
													className={
														order.status === 'pending'
															? 'bg-yellow-500/20 text-yellow-500'
															: order.status === 'paid'
															? 'bg-blue-500/20 text-blue-500'
															: order.status === 'completed'
															? 'bg-green-500/20 text-green-500'
															: 'bg-red-500/20 text-red-500'
													}
												>
													{order.status}
												</Badge>
											</div>
										</div>
									</Link>
								)
							})}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Top Products</CardTitle>
						<CardDescription>Best selling products</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{topProducts.map((item, index) => (
								<div
									key={item.product?.id || index}
									className="flex items-center gap-4 rounded-lg border p-4"
								>
									{item.product?.image && (
										<div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
											<Image
												src={item.product.image}
												alt={item.product?.name || 'Product'}
												fill
												className="object-cover"
												unoptimized
											/>
										</div>
									)}
									<div className="flex-1">
										<p className="font-semibold">
											{item.product?.name || 'Unknown Product'}
										</p>
										<p className="text-sm text-muted-foreground">
											{item.quantity} sold
										</p>
									</div>
									<div className="text-right">
										<p className="font-semibold">
											{item.product
												? formatCurrency(item.product.price)
												: 'N/A'}
										</p>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

