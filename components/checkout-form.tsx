'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@prisma/client'
import { useToast } from '@/hooks/use-toast'
import { Loader2, ShoppingCart, Package, Calendar, Tag, ArrowRight, CheckCircle2 } from 'lucide-react'

interface CheckoutFormProps {
	product: Product
	userId: string
}

export function CheckoutForm({ product, userId }: CheckoutFormProps) {
	const router = useRouter()
	const { toast } = useToast()
	const [quantity, setQuantity] = useState(1)
	const [isLoading, setIsLoading] = useState(false)

	const total = product.price * quantity

	const handleCheckout = async () => {
		// Check stock only for non-key and non-script products
		if (product.type !== 'key' && product.type !== 'script' && quantity > product.stock) {
			toast({
				title: 'Error',
				description: 'Not enough stock available',
				variant: 'destructive',
			})
			return
		}

		setIsLoading(true)

		try {
			const response = await fetch('/api/orders/create', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					productId: product.id,
					quantity,
					userId,
				}),
			})

			const data = await response.json()

			if (!response.ok) {
				// Use detailed error message if available
				const errorMessage = data.message || data.error || 'Failed to create order'
				
				// Handle specific error cases
				if (response.status === 401) {
					toast({
						title: 'Authentication Required',
						description: 'Please log in to create an order',
						variant: 'destructive',
					})
					router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`)
					return
				}

				if (response.status === 409) {
					toast({
						title: 'Order Conflict',
						description: errorMessage,
						variant: 'destructive',
					})
					// Refresh the page to get updated state
					setTimeout(() => window.location.reload(), 2000)
					return
				}

				// For other errors, show the error message
				toast({
					title: 'Error',
					description: errorMessage,
					variant: 'destructive',
				})
				return
			}

			// Success - redirect to payment page
			if (data.orderId) {
				router.push(`/orders/${data.orderId}/payment`)
			} else {
				throw new Error('Order created but no order ID returned')
			}
		} catch (error) {
			console.error('Error creating order:', error)
			
			// Handle network errors
			if (error instanceof TypeError && error.message.includes('fetch')) {
				toast({
					title: 'Network Error',
					description: 'Unable to connect to the server. Please check your internet connection and try again.',
					variant: 'destructive',
				})
				return
			}

			// Handle other errors
			toast({
				title: 'Error',
				description: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
				variant: 'destructive',
			})
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className="mx-auto max-w-6xl px-4 py-8">
			<div className="mb-8">
				<h1 className="text-3xl font-bold tracking-tight mb-2">Checkout</h1>
				<p className="text-muted-foreground">Review your order and proceed to payment</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Product Information Card */}
				<div className="lg:col-span-2">
					<Card className="overflow-hidden">
						{product.image && (
							<div className="relative h-64 w-full overflow-hidden bg-muted">
								<Image
									src={product.image}
									alt={product.name}
									fill
									className="object-cover transition-transform duration-300 hover:scale-105"
									unoptimized
								/>
							</div>
						)}
						<CardHeader className="space-y-4">
							<div className="flex items-start justify-between gap-4">
								<CardTitle className="text-2xl leading-tight flex-1">{product.name}</CardTitle>
								{product.category && (
									<Badge variant="secondary" className="shrink-0">
										<Tag className="mr-1 h-3 w-3" />
										{product.category}
									</Badge>
								)}
							</div>
							{product.description && (
								<div className="markdown-content">
									<ReactMarkdown remarkPlugins={[remarkGfm]}>
										{product.description}
									</ReactMarkdown>
								</div>
							)}
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Product Details */}
							<div className="grid gap-4 sm:grid-cols-2">
								{product.type !== 'key' && product.type !== 'script' && (
									<div className="flex items-center gap-3 rounded-lg border bg-card p-4">
										<div className="rounded-full bg-primary/10 p-2">
											<Package className="h-5 w-5 text-primary" />
										</div>
										<div>
											<p className="text-sm font-medium">Stock Available</p>
											<p className="text-2xl font-bold text-primary">{product.stock}</p>
										</div>
									</div>
								)}
								{product.type === 'key' && product.expireDays && (
									<div className="flex items-center gap-3 rounded-lg border bg-card p-4">
										<div className="rounded-full bg-primary/10 p-2">
											<Calendar className="h-5 w-5 text-primary" />
										</div>
										<div>
											<p className="text-sm font-medium">Expiration</p>
											<p className="text-lg font-semibold">
												{product.expireDays === 'Never' ? 'Never Expires' : product.expireDays}
											</p>
										</div>
									</div>
								)}
								<div className="flex items-center gap-3 rounded-lg border bg-card p-4">
									<div className="rounded-full bg-primary/10 p-2">
										<Tag className="h-5 w-5 text-primary" />
									</div>
									<div>
										<p className="text-sm font-medium">Unit Price</p>
										<p className="text-2xl font-bold text-primary">{formatCurrency(product.price)}</p>
									</div>
								</div>
							</div>

							{/* Quantity Input */}
							{product.type !== 'key' && product.type !== 'script' && (
								<div className="space-y-3 rounded-lg border bg-card p-4">
									<Label htmlFor="quantity" className="text-base font-semibold">
										Quantity
									</Label>
									<div className="flex items-center gap-4">
										<Button
											variant="outline"
											size="icon"
											onClick={() => setQuantity(Math.max(1, quantity - 1))}
											disabled={quantity <= 1}
											className="h-10 w-10 shrink-0"
										>
											−
										</Button>
										<Input
											id="quantity"
											type="number"
											min="1"
											max={product.stock}
											value={quantity}
											onChange={(e) => {
												const value = parseInt(e.target.value) || 1
												setQuantity(Math.min(Math.max(1, value), product.stock))
											}}
											className="h-10 text-center text-lg font-semibold"
										/>
										<Button
											variant="outline"
											size="icon"
											onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
											disabled={quantity >= product.stock}
											className="h-10 w-10 shrink-0"
										>
											+
										</Button>
									</div>
									<p className="text-sm text-muted-foreground">
										{product.stock} available in stock
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Order Summary Card */}
				<div className="lg:col-span-1">
					<Card className="sticky top-8">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<ShoppingCart className="h-5 w-5" />
								Order Summary
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-3">
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">Product</span>
									<span className="font-medium">{product.name}</span>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">Unit Price</span>
									<span className="font-medium">{formatCurrency(product.price)}</span>
								</div>
								{quantity > 1 && (
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">Quantity</span>
										<span className="font-medium">× {quantity}</span>
									</div>
								)}
							</div>

							<div className="border-t pt-4">
								<div className="flex items-center justify-between">
									<span className="text-lg font-semibold">Total</span>
									<span className="text-2xl font-bold text-primary">{formatCurrency(total)}</span>
								</div>
							</div>

							<div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-sm">
								<CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
								<p className="text-muted-foreground">
									Secure payment with PromptPay. Your order will be processed immediately after payment confirmation.
								</p>
							</div>
						</CardContent>
						<CardFooter className="pt-4">
							<Button
								className="w-full h-12 text-base font-semibold"
								onClick={handleCheckout}
								disabled={
									isLoading ||
									quantity < 1 ||
									(product.type !== 'key' && product.type !== 'script' && quantity > product.stock)
								}
								size="lg"
							>
								{isLoading ? (
									<>
										<Loader2 className="mr-2 h-5 w-5 animate-spin" />
										Processing...
									</>
								) : (
									<>
										Proceed to Payment
										<ArrowRight className="ml-2 h-5 w-5" />
									</>
								)}
							</Button>
						</CardFooter>
					</Card>
				</div>
			</div>
		</div>
	)
}

