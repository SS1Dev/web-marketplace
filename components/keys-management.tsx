'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import type { Order, OrderItem, Product, User, Key } from '@prisma/client'
import { Key as KeyIcon, Plus, Eye, Search, Filter, X, CheckCircle2, Clock } from 'lucide-react'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'

interface KeysManagementProps {
	orders: (Order & {
		items: (OrderItem & {
			keys: Key[]
		})[]
	})[]
}

export function KeysManagement({ orders: initialOrders }: KeysManagementProps) {
	const router = useRouter()
	const { toast } = useToast()
	const [orders] = useState(initialOrders)
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [selectedOrderItem, setSelectedOrderItem] = useState<{
		orderId: string
		orderItemId: string
		productName: string
		quantity: number
		generatedCount: number
	} | null>(null)
	const [quantity, setQuantity] = useState(1)
	const [isLoading, setIsLoading] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [filterStatus, setFilterStatus] = useState<string>('all')
	const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())

	const handleGenerateKeys = async () => {
		if (!selectedOrderItem) return

		setIsLoading(true)
		try {
			const response = await fetch('/api/keys/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					orderId: selectedOrderItem.orderId,
					orderItemId: selectedOrderItem.orderItemId,
					quantity,
				}),
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Failed to generate keys')
			}

			toast({
				title: 'Success',
				description: `Generated ${data.keys.length} key(s) successfully`,
				variant: 'success',
			})

			setIsDialogOpen(false)
			router.refresh()
		} catch (error) {
			toast({
				title: 'Error',
				description: error instanceof Error ? error.message : 'Something went wrong',
				variant: 'destructive',
			})
		} finally {
			setIsLoading(false)
		}
	}

	const openGenerateDialog = (order: Order, item: OrderItem & { keys: Key[] }) => {
		const productData = item.productData as any
		setSelectedOrderItem({
			orderId: order.id,
			orderItemId: item.id,
			productName: productData?.name || 'Unknown Product',
			quantity: item.quantity,
			generatedCount: item.keys.length,
		})
		setQuantity(item.quantity - item.keys.length)
		setIsDialogOpen(true)
	}

	const toggleOrderExpansion = (orderId: string) => {
		setExpandedOrders((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(orderId)) {
				newSet.delete(orderId)
			} else {
				newSet.add(orderId)
			}
			return newSet
		})
	}

	// Filter orders
	const filteredOrders = useMemo(() => {
		let filtered = [...orders]

		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase()
			filtered = filtered.filter((order) => {
				const userData = order.userData as any
				const userName = (userData?.name || userData?.email || '').toLowerCase()
				const orderId = order.id.toLowerCase()
				
				// Search in order items
				const hasMatchingItem = order.items.some((item) => {
					const productData = item.productData as any
					return productData?.name?.toLowerCase().includes(query)
				})

				return userName.includes(query) || orderId.includes(query) || hasMatchingItem
			})
		}

		// Status filter
		if (filterStatus !== 'all') {
			filtered = filtered.filter((order) => {
				if (filterStatus === 'pending') {
					return order.items.some((item) => item.keys.length < item.quantity)
				}
				if (filterStatus === 'completed') {
					return order.items.every((item) => item.keys.length === item.quantity)
				}
				return true
			})
		}

		return filtered
	}, [orders, searchQuery, filterStatus])

	const totalPendingKeys = orders.reduce((sum, order) => {
		return sum + order.items.reduce((itemSum, item) => {
			return itemSum + Math.max(0, item.quantity - item.keys.length)
		}, 0)
	}, 0)

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Keys</h1>
					<p className="text-muted-foreground mt-1">Manage and generate product keys</p>
				</div>
				{totalPendingKeys > 0 && (
					<Badge variant="destructive" className="text-base px-4 py-1">
						{totalPendingKeys} Pending Key{totalPendingKeys > 1 ? 's' : ''}
					</Badge>
				)}
			</div>

			{/* Search and Filters */}
			<Card>
				<CardContent className="pt-6">
					<div className="flex flex-wrap gap-4">
						<div className="relative flex-1 min-w-[200px]">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search by order ID, customer name, or product..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10"
							/>
							{searchQuery && (
								<Button
									variant="ghost"
									size="icon"
									className="absolute right-1 top-1/2 -translate-y-1/2"
									onClick={() => setSearchQuery('')}
								>
									<X className="h-4 w-4" />
								</Button>
							)}
						</div>
						<Select value={filterStatus} onValueChange={setFilterStatus}>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Filter Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Orders</SelectItem>
								<SelectItem value="pending">Pending Keys</SelectItem>
								<SelectItem value="completed">Completed</SelectItem>
							</SelectContent>
						</Select>
						{(searchQuery || filterStatus !== 'all') && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setSearchQuery('')
									setFilterStatus('all')
								}}
							>
								<X className="mr-2 h-4 w-4" />
								Clear
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Results */}
			<div className="text-sm text-muted-foreground">
				Showing {filteredOrders.length} of {orders.length} orders
			</div>

			<div className="space-y-4">
				{filteredOrders.length === 0 ? (
					<Card>
						<CardContent className="py-12 text-center">
							<p className="text-muted-foreground">No orders found. Try adjusting your filters.</p>
						</CardContent>
					</Card>
				) : (
					filteredOrders.map((order) => {
						const userData = order.userData as any
						const isExpanded = expandedOrders.has(order.id)
						const hasPendingKeys = order.items.some((item) => item.keys.length < item.quantity)
						
						return (
							<Card key={order.id}>
								<CardHeader>
									<div 
										className="flex items-center justify-between cursor-pointer hover:bg-accent/50 rounded-lg p-2 -m-2 transition-colors"
										onClick={() => toggleOrderExpansion(order.id)}
									>
										<div className="flex-1">
											<div className="flex items-center gap-3">
												<CardTitle>Order #{order.id.slice(0, 8)}</CardTitle>
												{hasPendingKeys ? (
													<Badge variant="destructive" className="gap-1">
														<Clock className="h-3 w-3" />
														Pending
													</Badge>
												) : (
													<Badge variant="default" className="bg-green-600 gap-1">
														<CheckCircle2 className="h-3 w-3" />
														Complete
													</Badge>
												)}
											</div>
											<CardDescription className="mt-1">
												{userData?.name || userData?.email || 'Unknown User'} • {formatDate(order.createdAt)}
											</CardDescription>
										</div>
										<Badge variant="outline">{order.status}</Badge>
									</div>
								</CardHeader>
								{isExpanded && (
									<CardContent>
										<div className="space-y-4">
											{order.items
												.filter((item) => {
													const productData = item.productData as any
													return productData?.type === 'key'
												})
												.map((item) => {
													const productData = item.productData as any
													return (
														<div
															key={item.id}
															className="rounded-lg border p-4"
														>
															<div className="flex items-start gap-4 mb-4">
																{productData?.image && (
																	<div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg">
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
																	<div className="flex items-center justify-between">
																		<div>
																			<h4 className="font-semibold">{productData?.name || 'Unknown Product'}</h4>
																			<p className="text-sm text-muted-foreground">
																				Quantity: {item.quantity} | Generated: {item.keys.length}
																				{item.keys.length === item.quantity && (
																					<span className="ml-2 text-green-600">✓ Auto-generated</span>
																				)}
																			</p>
																		</div>
																		{item.keys.length < item.quantity && (
																			<Button
																				size="sm"
																				onClick={() => openGenerateDialog(order, item)}
																			>
																				<Plus className="mr-2 h-4 w-4" />
																				Generate Remaining Keys
																			</Button>
																		)}
																	</div>
																</div>
															</div>
															{item.keys.length > 0 && (
																<div className="mt-4 space-y-2">
																	<h5 className="text-sm font-semibold mb-2">Generated Keys:</h5>
																	<div className="space-y-2">
																		{item.keys.map((key) => (
																			<div
																				key={key.id}
																				className="flex items-center justify-between rounded-lg border p-3 text-sm bg-muted/50"
																			>
																				<div className="flex-1 min-w-0">
																					<p className="font-mono text-xs break-all">{key.key}</p>
																					<div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
																						{!key.activateDate ? (
																							<Badge variant="secondary" className="text-yellow-600 bg-yellow-600/20">
																								Unused
																							</Badge>
																						) : (
																							<>
																								<Badge variant="secondary" className="text-green-600 bg-green-600/20">
																									Activated: {formatDate(key.activateDate)}
																								</Badge>
																								{key.expireDate && (
																									<span>Expires: {formatDate(key.expireDate)}</span>
																								)}
																							</>
																						)}
																						{key.hwid && (
																							<span className="font-mono text-xs">HWID: {key.hwid}</span>
																						)}
																					</div>
																				</div>
																			</div>
																		))}
																	</div>
																</div>
															)}
														</div>
													)
												})}
										</div>
									</CardContent>
								)}
							</Card>
						)
					})
				)}
			</div>

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Generate Keys</DialogTitle>
						<DialogDescription>
							Generate keys for {selectedOrderItem?.productName}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="quantity">Number of Keys to Generate</Label>
							<Input
								id="quantity"
								type="number"
								min="1"
								max={selectedOrderItem ? selectedOrderItem.quantity - selectedOrderItem.generatedCount : 1}
								value={quantity}
								onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
							/>
							<p className="text-xs text-muted-foreground">
								Remaining: {selectedOrderItem ? selectedOrderItem.quantity - selectedOrderItem.generatedCount : 0}
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button onClick={handleGenerateKeys} disabled={isLoading}>
							{isLoading ? 'Generating...' : 'Generate'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

