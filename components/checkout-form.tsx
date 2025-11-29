'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
		<div className="mx-auto max-w-md">
			<Card className="flex flex-col hover:shadow-lg transition-shadow">
				{product.image && (
					<div className="relative h-48 w-full overflow-hidden rounded-t-lg">
						<Image
							src={product.image}
							alt={product.name}
							fill
							className="object-cover"
							unoptimized
						/>
					</div>
				)}
				<CardHeader>
					<CardTitle className="line-clamp-2">{product.name}</CardTitle>
					<CardDescription className="line-clamp-2">
						{product.description || 'No description'}
					</CardDescription>
				</CardHeader>
				<CardContent className="flex-1 space-y-4">
					<div className="space-y-2">
						<div className="text-2xl font-bold text-primary">
							{formatCurrency(product.price)}
						</div>
						{product.type !== 'key' && product.type !== 'script' && (
							<div className="text-sm text-muted-foreground">
								Stock: {product.stock}
							</div>
						)}
						{product.type === 'key' && product.expireDays && (
							<div className="text-sm text-muted-foreground">
								Expires: {product.expireDays === 'Never' ? 'Never' : product.expireDays}
							</div>
						)}
						{product.category && (
							<div className="text-xs text-muted-foreground">
								Category: {product.category}
							</div>
						)}
					</div>

					{product.type !== 'key' && product.type !== 'script' && (
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

					{(product.type === 'key' || product.type === 'script') && (
						<div className="space-y-2 border-t pt-4">
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Quantity:</span>
								<span>{quantity}</span>
							</div>
						</div>
					)}

					<div className="space-y-2 border-t pt-4">
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Unit Price:</span>
							<span>{formatCurrency(product.price)}</span>
						</div>
						{quantity > 1 && (
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Quantity:</span>
								<span>{quantity}</span>
							</div>
						)}
						<div className="flex justify-between text-lg font-bold border-t pt-2">
							<span>Total:</span>
							<span className="text-primary">{formatCurrency(total)}</span>
						</div>
					</div>
				</CardContent>
				<CardFooter>
					<Button
						className="w-full"
						onClick={handleCheckout}
						disabled={
							isLoading ||
							quantity < 1 ||
							(product.type !== 'key' && product.type !== 'script' && quantity > product.stock)
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
				</CardFooter>
			</Card>
		</div>
	)
}

