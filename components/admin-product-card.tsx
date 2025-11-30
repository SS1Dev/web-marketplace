'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@prisma/client'
import { Edit, Trash2 } from 'lucide-react'

interface AdminProductCardProps {
	product: Product
	onEdit: () => void
	onDelete: () => void
	onToggleActive: (productId: string, isActive: boolean) => Promise<void>
}

export function AdminProductCard({ product, onEdit, onDelete, onToggleActive }: AdminProductCardProps) {
	const [isDescriptionOpen, setIsDescriptionOpen] = useState(false)
	const [isActive, setIsActive] = useState(product.isActive)
	const [isToggling, setIsToggling] = useState(false)

	const handleDescriptionClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (product.description) {
			setIsDescriptionOpen(true)
		}
	}

	const handleEdit = (e: React.MouseEvent) => {
		e.stopPropagation()
		onEdit()
	}

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation()
		onDelete()
	}

	const handleToggleActive = async (checked: boolean) => {
		setIsToggling(true)
		const previousValue = isActive
		setIsActive(checked)
		try {
			await onToggleActive(product.id, checked)
		} catch (error) {
			// Revert on error
			setIsActive(previousValue)
		} finally {
			setIsToggling(false)
		}
	}

	return (
		<>
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
						<div className="flex items-center justify-between pt-2 border-t">
							<Label htmlFor={`active-${product.id}`} className="text-xs text-muted-foreground cursor-pointer">
								{isActive ? 'Active' : 'Inactive'}
							</Label>
							<Switch
								id={`active-${product.id}`}
								checked={isActive}
								onCheckedChange={handleToggleActive}
								disabled={isToggling}
								onClick={(e) => e.stopPropagation()}
							/>
						</div>
					</div>
				</CardContent>
				<CardFooter className="flex gap-2">
					<Button
						variant="outline"
						className="flex-1"
						onClick={handleEdit}
					>
						<Edit className="mr-2 h-4 w-4" />
						Edit
					</Button>
					<Button
						variant="destructive"
						className="flex-1"
						onClick={handleDelete}
					>
						<Trash2 className="mr-2 h-4 w-4" />
						Delete
					</Button>
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
							<div className="text-sm text-muted-foreground">
								Status: {product.isActive ? 'Active' : 'Inactive'}
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}

