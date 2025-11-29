'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@prisma/client'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

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
		// Check stock only for non-key products
		if (product.type !== 'key' && quantity > product.stock) {
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
				throw new Error(data.error || 'Failed to create order')
			}

			router.push(`/orders/${data.orderId}/payment`)
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

	return (
		<div className="mx-auto max-w-2xl">
			<Card>
				<CardHeader>
					<CardTitle>Checkout</CardTitle>
					<CardDescription>Review your order</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{product.image && (
						<div className="relative h-64 w-full overflow-hidden rounded-lg">
							<Image
								src={product.image}
								alt={product.name}
								fill
								className="object-cover"
								unoptimized
							/>
						</div>
					)}
					<div>
						<h3 className="text-lg font-semibold">{product.name}</h3>
						<p className="text-sm text-muted-foreground">
							{product.description}
						</p>
					</div>

					{product.type !== 'key' && (
						<div className="space-y-2">
							<Label htmlFor="quantity">Quantity</Label>
							<Input
								id="quantity"
								type="number"
								min="1"
								max={product.stock}
								value={quantity}
								onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
							/>
							<p className="text-xs text-muted-foreground">
								Available: {product.stock}
							</p>
						</div>
					)}

					<div className="space-y-2 border-t pt-4">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Unit Price:</span>
							<span>{formatCurrency(product.price)}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Quantity:</span>
							<span>{quantity}</span>
						</div>
						<div className="flex justify-between text-lg font-bold">
							<span>Total:</span>
							<span className="text-primary">{formatCurrency(total)}</span>
						</div>
					</div>

					<Button
						className="w-full"
						onClick={handleCheckout}
						disabled={
							isLoading ||
							quantity < 1 ||
							(product.type !== 'key' && quantity > product.stock)
						}
					>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Processing...
							</>
						) : (
							'Proceed to Payment'
						)}
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}

