'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { MaskedInput } from '@/components/masked-input'
import { useToast } from '@/hooks/use-toast'
import type { Order, OrderItem, Product, User, Key } from '@prisma/client'
import { ArrowLeft, X } from 'lucide-react'

interface OrderDetailProps {
	order: Order & {
		items: (OrderItem & { keys: Key[] })[]
	}
}

const statusColors = {
	pending: 'bg-yellow-500/20 text-yellow-500',
	paid: 'bg-blue-500/20 text-blue-500',
	completed: 'bg-green-500/20 text-green-500',
	cancelled: 'bg-red-500/20 text-red-500',
}

export function OrderDetail({ order }: OrderDetailProps) {
	const router = useRouter()
	const { toast } = useToast()
	const [isCancelling, setIsCancelling] = useState(false)

	const handleCancel = async () => {
		if (!confirm('Are you sure you want to cancel this order?')) {
			return
		}

		setIsCancelling(true)

		try {
			const response = await fetch(`/api/orders/${order.id}/cancel`, {
				method: 'POST',
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Failed to cancel order')
			}

			toast({
				title: 'Success',
				description: 'Order cancelled successfully',
				variant: 'success',
			})

			router.refresh()
		} catch (error) {
			toast({
				title: 'Error',
				description: error instanceof Error ? error.message : 'Something went wrong',
				variant: 'destructive',
			})
		} finally {
			setIsCancelling(false)
		}
	}

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<Link href="/orders">
				<Button variant="ghost" size="sm">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Orders
				</Button>
			</Link>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Order #{order.id.slice(0, 8)}</CardTitle>
							<CardDescription>
								Placed on {formatDate(order.createdAt)}
							</CardDescription>
						</div>
						<Badge className={statusColors[order.status as keyof typeof statusColors]}>
							{order.status.toUpperCase()}
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="space-y-6">
					<div>
						<h3 className="mb-4 text-lg font-semibold">Order Items</h3>
						<div className="space-y-4">
							{order.items.map((item) => {
								const productData = item.productData as any
								return (
									<div
										key={item.id}
										className="flex items-start gap-4 rounded-lg border p-4"
									>
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
											<h4 className="font-semibold">{productData?.name || 'Unknown Product'}</h4>
											<p className="text-sm text-muted-foreground">
												Quantity: {item.quantity}
											</p>
													{order.status === 'paid' || order.status === 'completed' ? (
														<div className="mt-4 space-y-3">
															{productData?.type === 'key' && (
													<div className="space-y-3">
														{item.keys && item.keys.length > 0 ? (
															item.keys.map((key, index) => (
																<div key={key.id} className="space-y-2 rounded-lg border p-3">
																	<MaskedInput
																		value={key.key}
																		label={`Key ${index + 1}`}
																	/>
																	<div className="text-xs text-muted-foreground space-y-1">
																		{!key.activateDate ? (
																			<p className="text-yellow-600 font-medium">Status: ยังไม่ถูกใช้งาน</p>
																		) : (
																			<>
																				<p>Activated: {formatDate(key.activateDate)}</p>
																				{key.expireDate && (
																					<p>Expires: {formatDate(key.expireDate)}</p>
																				)}
																			</>
																		)}
																		{key.hwid && <p>HWID: {key.hwid}</p>}
																		{key.placeId && <p>PlaceID: {key.placeId}</p>}
																	</div>
																</div>
															))
														) : item.code ? (
															<MaskedInput
																value={item.code}
																label="Key"
															/>
														) : (
															<p className="text-sm text-muted-foreground">
																Keys are being generated. Please check back later.
															</p>
														)}
													</div>
															)}
															{productData?.type === 'id' && (
													<>
														{item.username && (
															<MaskedInput
																value={item.username}
																label="Username"
															/>
														)}
														{item.password && (
															<MaskedInput
																value={item.password}
																label="Password"
															/>
														)}
													</>
															)}
															{productData?.type === 'other' && item.code && (
													<div className="mt-2 rounded bg-muted p-2">
														<p className="text-xs text-muted-foreground">Code:</p>
														<p className="font-mono text-sm">{item.code}</p>
													</div>
															)}
														</div>
													) : (
														<div className="mt-2 text-sm text-muted-foreground">
															Payment required to view details
														</div>
													)}
										</div>
										<div className="text-right">
											<p className="font-semibold">
												{formatCurrency(item.price * item.quantity)}
											</p>
											<p className="text-sm text-muted-foreground">
												{formatCurrency(item.price)}
											</p>
										</div>
									</div>
								)
							})}
						</div>
					</div>

					<div className="space-y-2 border-t pt-4">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Subtotal:</span>
							<span>{formatCurrency(order.totalAmount)}</span>
						</div>
						<div className="flex justify-between text-lg font-bold">
							<span>Total:</span>
							<span className="text-primary">{formatCurrency(order.totalAmount)}</span>
						</div>
					</div>

					{order.status === 'pending' && (
						<div className="flex gap-2">
							<Button
								variant="destructive"
								onClick={handleCancel}
								disabled={isCancelling}
								className="flex-1"
							>
								<X className="mr-2 h-4 w-4" />
								{isCancelling ? 'Cancelling...' : 'Cancel Order'}
							</Button>
							<Link href={`/orders/${order.id}/payment`} className="flex-1">
								<Button className="w-full">Complete Payment</Button>
							</Link>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

