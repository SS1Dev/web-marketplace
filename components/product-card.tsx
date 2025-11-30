'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@prisma/client'
import { ShoppingCart, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

interface ProductCardProps {
	product: Product
}

export function ProductCard({ product }: ProductCardProps) {
	const router = useRouter()
	const { data: session } = useSession()
	const [isDescriptionOpen, setIsDescriptionOpen] = useState(false)
	const [isSourceCodeOpen, setIsSourceCodeOpen] = useState(false)

	const handleBuy = () => {
		if (!session) {
			// Redirect to login with callback URL
			router.push(`/login?callbackUrl=${encodeURIComponent(`/products/${product.id}/checkout`)}`)
			return
		}
		router.push(`/products/${product.id}/checkout`)
	}

	const handleGetFree = () => {
		if (product.price === 0 && (product as any).sourceCode) {
			setIsSourceCodeOpen(true)
		}
	}

	const handleDescriptionClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (product.description) {
			setIsDescriptionOpen(true)
		}
	}

	return (
		<>
			<Card className="flex flex-col hover:shadow-lg transition-shadow">
				{product.image && (
					<div className="relative block h-48 w-full overflow-hidden rounded-t-lg">
						<Image
							src={product.image}
							alt={`${product.name} - ${product.category || 'Product'}`}
							fill
							className="object-cover"
							unoptimized
						/>
					</div>
				)}
				<CardHeader>
					<CardTitle className="line-clamp-2">
						{product.name}
					</CardTitle>
					<CardDescription 
						className={`line-clamp-2 ${product.description ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
						onClick={handleDescriptionClick}
					>
						{product.description || 'No description'}
					</CardDescription>
				</CardHeader>
			<CardContent className="flex-1">
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
			</CardContent>
			<CardFooter>
				{product.price === 0 && (product.type === 'script' || (product as any).sourceCode) ? (
					<Button
						className="w-full"
						onClick={(e) => {
							e.stopPropagation()
							handleGetFree()
						}}
					>
						<Download className="mr-2 h-4 w-4" />
						Get Free
					</Button>
				) : (
					<Button
						className="w-full"
						onClick={(e) => {
							e.stopPropagation()
							handleBuy()
						}}
						disabled={product.type !== 'key' && product.stock === 0}
					>
						<ShoppingCart className="mr-2 h-4 w-4" />
						{product.type !== 'key' && product.stock === 0
							? 'Out of Stock'
							: 'Buy Now'}
					</Button>
				)}
			</CardFooter>
		</Card>

		<Dialog open={isDescriptionOpen} onOpenChange={setIsDescriptionOpen}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{product.name}</DialogTitle>
					<DialogDescription>Product Description</DialogDescription>
				</DialogHeader>
				<div className="mt-4">
					{product.image && (
						<div className="relative h-64 w-full mb-4 overflow-hidden rounded-lg">
							<Image
								src={product.image}
								alt={product.name}
								fill
								className="object-cover"
								unoptimized
							/>
						</div>
					)}
					<div className="whitespace-pre-wrap text-sm text-foreground">
						{product.description}
					</div>
					<div className="mt-4 pt-4 border-t space-y-2">
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
							<div className="text-sm text-muted-foreground">
								Category: {product.category}
							</div>
						)}
					</div>
				</div>
				</DialogContent>
			</Dialog>

			<Dialog open={isSourceCodeOpen} onOpenChange={setIsSourceCodeOpen}>
				<DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{product.name}</DialogTitle>
						<DialogDescription>Source Code</DialogDescription>
					</DialogHeader>
					<div className="mt-4">
						{product.image && (
							<div className="relative h-48 w-full mb-4 overflow-hidden rounded-lg">
								<Image
									src={product.image}
									alt={product.name}
									fill
									className="object-cover"
									unoptimized
								/>
							</div>
						)}
						<div className="space-y-4">
							{product.description && (
								<div>
									<h3 className="text-sm font-semibold mb-2">Description</h3>
									<div className="whitespace-pre-wrap text-sm text-foreground bg-muted p-3 rounded-md">
										{product.description}
									</div>
								</div>
							)}
							<div>
								<h3 className="text-sm font-semibold mb-2">Source Code</h3>
								<pre className="whitespace-pre-wrap text-xs text-foreground bg-muted p-4 rounded-md overflow-x-auto">
									{(product as any).sourceCode || 'No source code available'}
								</pre>
							</div>
							<div className="flex gap-2 pt-4 border-t">
								<Button
									variant="outline"
									className="flex-1"
									onClick={() => {
										const sourceCode = (product as any).sourceCode
										if (sourceCode) {
											navigator.clipboard.writeText(sourceCode)
											alert('Source code copied to clipboard!')
										}
									}}
								>
									Copy Code
								</Button>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}

