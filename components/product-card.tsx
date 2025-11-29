'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@prisma/client'
import { ShoppingCart } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ProductCardProps {
	product: Product
}

export function ProductCard({ product }: ProductCardProps) {
	const router = useRouter()

	const handleBuy = () => {
		router.push(`/products/${product.id}/checkout`)
	}

	return (
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
			<CardContent className="flex-1">
				<div className="space-y-2">
					<div className="text-2xl font-bold text-primary">
						{formatCurrency(product.price)}
					</div>
					{product.type !== 'key' && (
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
			</CardContent>
			<CardFooter>
				<Button
					className="w-full"
					onClick={handleBuy}
					disabled={product.type !== 'key' && product.stock === 0}
				>
					<ShoppingCart className="mr-2 h-4 w-4" />
					{product.type !== 'key' && product.stock === 0
						? 'Out of Stock'
						: 'Buy Now'}
				</Button>
			</CardFooter>
		</Card>
	)
}

