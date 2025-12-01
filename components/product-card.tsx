'use client'

import { useState } from 'react'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
			<Card className="group flex flex-col h-full hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 border border-border/50 hover:border-primary/30 overflow-hidden bg-card">
				{/* Image Section - Better aspect ratio */}
				{product.image ? (
					<div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
						<Image
							src={product.image}
							alt={`${product.name} - ${product.category || 'Product'}`}
							fill
							className="object-cover transition-transform duration-500 group-hover:scale-110"
							unoptimized
						/>
						{/* Overlay gradient */}
						<div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
					</div>
				) : (
					<div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
						<ShoppingCart className="h-12 w-12 text-muted-foreground/30" />
					</div>
				)}

				{/* Content Section - Better spacing */}
				<CardHeader className="pb-2 pt-4 px-4">
					<CardTitle className="line-clamp-2 text-base font-bold leading-tight mb-1.5 group-hover:text-primary transition-colors">
						{product.name}
					</CardTitle>
					<CardDescription 
						className={`line-clamp-2 text-xs leading-relaxed min-h-[2.5rem] ${product.description ? 'cursor-pointer hover:text-primary transition-colors' : 'text-muted-foreground/60'}`}
						onClick={handleDescriptionClick}
					>
						{product.description || 'No description available'}
					</CardDescription>
				</CardHeader>

				<CardContent className="flex-1 flex flex-col justify-between px-4 pb-3">
					{/* Price and Info Section */}
					<div className="space-y-2 mb-3">
						<div className="flex items-baseline gap-2">
							<span className="text-2xl font-bold text-primary">
								{formatCurrency(product.price)}
							</span>
							{product.price === 0 && (
								<Badge variant="secondary" className="text-xs font-semibold bg-primary/20 text-primary border-primary/30">
									FREE
								</Badge>
							)}
						</div>
						
						{/* Product Info */}
						<div className="flex flex-wrap gap-2 text-xs">
							{product.type !== 'key' && product.type !== 'script' && product.stock > 0 && (
								<span className="text-muted-foreground">
									✓ In Stock ({product.stock})
								</span>
							)}
							{product.type === 'key' && product.expireDays && (
								<span className="text-muted-foreground">
									⏱ {product.expireDays === 'Never' ? 'Never Expires' : `Expires: ${product.expireDays}`}
								</span>
							)}
							{product.category && (
								<span className="text-muted-foreground/70 capitalize">
									{product.category}
								</span>
							)}
						</div>
					</div>
				</CardContent>

				{/* Footer - Button */}
				<CardFooter className="px-4 pb-4 pt-0">
					{product.price === 0 && (product.type === 'script' || (product as any).sourceCode) ? (
						<Button
							className="w-full h-10 text-sm font-semibold shadow-sm hover:shadow-md transition-shadow"
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
							className="w-full h-10 text-sm font-semibold shadow-sm hover:shadow-md transition-shadow"
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
					<div className="markdown-content">
						<ReactMarkdown remarkPlugins={[remarkGfm]}>
							{product.description}
						</ReactMarkdown>
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
									<div className="markdown-content bg-muted p-3 rounded-md">
										<ReactMarkdown remarkPlugins={[remarkGfm]}>
											{product.description}
										</ReactMarkdown>
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

