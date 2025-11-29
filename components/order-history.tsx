'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Order, OrderItem } from '@prisma/client'
import { Grid3x3, Table2, Filter, ArrowRight } from 'lucide-react'

interface OrderHistoryProps {
	orders: (Order & {
		items: OrderItem[]
	})[]
}

type ViewMode = 'grid' | 'table'
type StatusFilter = 'all' | 'pending' | 'paid' | 'completed' | 'cancelled'

const statusColors = {
	pending: 'bg-yellow-500/20 text-yellow-500',
	paid: 'bg-blue-500/20 text-blue-500',
	completed: 'bg-green-500/20 text-green-500',
	cancelled: 'bg-red-500/20 text-red-500',
}

export function OrderHistory({ orders: initialOrders }: OrderHistoryProps) {
	const [viewMode, setViewMode] = useState<ViewMode>('table')
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

	const filteredOrders = useMemo(() => {
		if (statusFilter === 'all') {
			return initialOrders
		}
		return initialOrders.filter((order) => order.status === statusFilter)
	}, [initialOrders, statusFilter])

	if (initialOrders.length === 0) {
		return (
			<Card>
				<CardContent className="py-12">
					<div className="text-center">
						<p className="text-muted-foreground">No orders found</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2">
						<Filter className="h-4 w-4" />
						<Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Filter by status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
								<SelectItem value="paid">Paid</SelectItem>
								<SelectItem value="completed">Completed</SelectItem>
								<SelectItem value="cancelled">Cancelled</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<Badge variant="outline">
						{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
					</Badge>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant={viewMode === 'grid' ? 'default' : 'outline'}
						size="sm"
						onClick={() => setViewMode('grid')}
					>
						<Grid3x3 className="mr-2 h-4 w-4" />
						Grid
					</Button>
					<Button
						variant={viewMode === 'table' ? 'default' : 'outline'}
						size="sm"
						onClick={() => setViewMode('table')}
					>
						<Table2 className="mr-2 h-4 w-4" />
						Table
					</Button>
				</div>
			</div>

			{viewMode === 'grid' ? (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{filteredOrders.map((order) => (
						<Link key={order.id} href={`/orders/${order.id}`}>
							<Card className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
								<CardHeader>
									<div className="flex items-center justify-between">
										<div>
											<CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
											<CardDescription>
												{formatDate(order.createdAt)}
											</CardDescription>
										</div>
										<Badge className={statusColors[order.status as keyof typeof statusColors]}>
											{order.status.toUpperCase()}
										</Badge>
									</div>
								</CardHeader>
								<CardContent className="flex-1 flex flex-col">
									<div className="space-y-2 flex-1">
										{order.items.slice(0, 2).map((item) => {
											const productData = item.productData as any
											return (
												<div key={item.id} className="flex items-center gap-2 text-sm">
													{productData?.image && (
														<div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded">
															<Image
																src={productData.image}
																alt={productData?.name || 'Product'}
																fill
																className="object-cover"
																unoptimized
															/>
														</div>
													)}
													<div className="flex-1 min-w-0">
														<p className="font-medium truncate">
															{productData?.name || 'Unknown Product'}
														</p>
														<p className="text-xs text-muted-foreground">
															x {item.quantity}
														</p>
													</div>
												</div>
											)
										})}
										{order.items.length > 2 && (
											<p className="text-xs text-muted-foreground">
												+{order.items.length - 2} more item{order.items.length - 2 !== 1 ? 's' : ''}
											</p>
										)}
									</div>
									<div className="mt-4 pt-4 border-t">
										<div className="flex justify-between items-center">
											<span className="text-sm font-semibold">Total:</span>
											<span className="text-lg font-bold text-primary">
												{formatCurrency(order.totalAmount)}
											</span>
										</div>
										{order.status === 'pending' && (
											<Link href={`/orders/${order.id}/payment`} onClick={(e) => e.stopPropagation()}>
												<Button size="sm" className="w-full mt-2" variant="outline">
													Complete Payment
													<ArrowRight className="ml-2 h-4 w-4" />
												</Button>
											</Link>
										)}
									</div>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			) : (
				<Card>
					<CardContent className="p-0">
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead>
									<tr className="border-b">
										<th className="text-left p-4 font-semibold">Order ID</th>
										<th className="text-left p-4 font-semibold">Date</th>
										<th className="text-left p-4 font-semibold">Items</th>
										<th className="text-left p-4 font-semibold">Total</th>
										<th className="text-left p-4 font-semibold">Status</th>
										<th className="text-left p-4 font-semibold">Action</th>
									</tr>
								</thead>
								<tbody>
									{filteredOrders.map((order) => (
										<tr key={order.id} className="border-b hover:bg-accent/50">
											<td className="p-4">
												<Link href={`/orders/${order.id}`} className="font-medium hover:underline">
													#{order.id.slice(0, 8)}
												</Link>
											</td>
											<td className="p-4 text-sm text-muted-foreground">
												{formatDate(order.createdAt)}
											</td>
											<td className="p-4">
												<div className="space-y-2">
													{order.items.map((item) => {
														const productData = item.productData as any
														return (
															<div key={item.id} className="flex items-center gap-2">
																{productData?.image && (
																	<div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded">
																		<Image
																			src={productData.image}
																			alt={productData?.name || 'Product'}
																			fill
																			className="object-cover"
																			unoptimized
																		/>
																	</div>
																)}
																<div>
																	<p className="text-sm font-medium">
																		{productData?.name || 'Unknown Product'}
																	</p>
																	<p className="text-xs text-muted-foreground">
																		x {item.quantity}
																	</p>
																</div>
															</div>
														)
													})}
												</div>
											</td>
											<td className="p-4 font-semibold">
												{formatCurrency(order.totalAmount)}
											</td>
											<td className="p-4">
												<Badge className={statusColors[order.status as keyof typeof statusColors]}>
													{order.status.toUpperCase()}
												</Badge>
											</td>
											<td className="p-4">
												<Link href={`/orders/${order.id}`}>
													<Button variant="ghost" size="sm">
														View
														<ArrowRight className="ml-2 h-4 w-4" />
													</Button>
												</Link>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}

