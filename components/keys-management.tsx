'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import type { Order, OrderItem, Product, User, Key } from '@prisma/client'
import { Key as KeyIcon, Plus, Eye } from 'lucide-react'
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
	const [orders, setOrders] = useState(initialOrders)
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

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl font-bold">Key Management</h1>
			</div>

			<div className="space-y-4">
				{orders.map((order) => (
					<Card key={order.id}>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Order #{order.id.slice(0, 8)}</CardTitle>
									<CardDescription>
										{(() => {
											const userData = order.userData as any
											return (userData?.name || userData?.email || 'Unknown User') + ' - ' + formatDate(order.createdAt)
										})()}
									</CardDescription>
								</div>
								<Badge>{order.status}</Badge>
							</div>
						</CardHeader>
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
													<h5 className="text-sm font-semibold">Generated Keys:</h5>
													<div className="space-y-2">
														{item.keys.map((key) => (
															<div
																key={key.id}
																className="flex items-center justify-between rounded bg-muted p-2 text-sm"
															>
																<div className="flex-1">
																	<p className="font-mono">{key.key}</p>
																	<div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
																		{!key.activateDate ? (
																			<span className="text-yellow-600 font-medium">Status: ยังไม่ถูกใช้งาน</span>
																		) : (
																			<>
																				<span>Activated: {formatDate(key.activateDate)}</span>
																				{key.expireDate && (
																					<span>Expires: {formatDate(key.expireDate)}</span>
																				)}
																			</>
																		)}
																		{key.hwid && <span>HWID: {key.hwid}</span>}
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
					</Card>
				))}
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

