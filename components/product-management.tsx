'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import type { Product } from '@prisma/client'
import { Plus, Edit, Trash2 } from 'lucide-react'

interface ProductManagementProps {
	products: Product[]
}

export function ProductManagement({ products: initialProducts }: ProductManagementProps) {
	const router = useRouter()
	const { toast } = useToast()
	const [products, setProducts] = useState(initialProducts)
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [editingProduct, setEditingProduct] = useState<Product | null>(null)
	const [formData, setFormData] = useState({
		name: '',
		description: '',
		price: '',
		stock: '',
		category: '',
		type: 'other',
		expireDays: '',
		image: '',
		sourceCode: '',
		isActive: true,
	})

	const handleOpenDialog = (product?: Product) => {
		if (product) {
			setEditingProduct(product)
			setFormData({
				name: product.name,
				description: product.description || '',
				price: product.price.toString(),
				stock: product.stock.toString(),
				category: product.category || '',
				type: product.type || 'other',
				expireDays: product.expireDays || '',
				image: product.image || '',
				sourceCode: (product as any).sourceCode || '',
				isActive: product.isActive,
			})
		} else {
			setEditingProduct(null)
			setFormData({
				name: '',
				description: '',
				price: '',
				stock: '',
				category: '',
				type: 'other',
				expireDays: '',
				image: '',
				sourceCode: '',
				isActive: true,
			})
		}
		setIsDialogOpen(true)
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		try {
			const url = editingProduct
				? `/api/admin/products/${editingProduct.id}`
				: '/api/admin/products'
			const method = editingProduct ? 'PUT' : 'POST'

			// Prepare request body - only include expireDays if type is 'key'
			const requestBody: any = {
				name: formData.name,
				description: formData.description,
				price: parseFloat(formData.price),
				stock: formData.type === 'key' ? 0 : parseInt(formData.stock),
				category: formData.category,
				type: formData.type,
				image: formData.image || null,
				sourceCode: formData.type === 'key' && formData.sourceCode ? formData.sourceCode : null,
				isActive: formData.isActive,
			}

			// Only include expireDays if type is 'key'
			if (formData.type === 'key') {
				requestBody.expireDays = formData.expireDays
			}

			const response = await fetch(url, {
				method,
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestBody),
			})

			if (!response.ok) {
				const data = await response.json()
				throw new Error(data.error || 'Failed to save product')
			}

			toast({
				title: 'Success',
				description: editingProduct
					? 'Product updated successfully'
					: 'Product created successfully',
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
		}
	}

	const handleDelete = async (productId: string) => {
		if (!confirm('Are you sure you want to delete this product?')) {
			return
		}

		try {
			const response = await fetch(`/api/admin/products/${productId}`, {
				method: 'DELETE',
			})

			if (!response.ok) {
				const data = await response.json()
				throw new Error(data.error || 'Failed to delete product')
			}

			toast({
				title: 'Success',
				description: 'Product deleted successfully',
				variant: 'success',
			})

			router.refresh()
		} catch (error) {
			toast({
				title: 'Error',
				description: error instanceof Error ? error.message : 'Something went wrong',
				variant: 'destructive',
			})
		}
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl font-bold">Product Management</h1>
				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button onClick={() => handleOpenDialog()}>
							<Plus className="mr-2 h-4 w-4" />
							Add Product
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{editingProduct ? 'Edit Product' : 'Add Product'}
							</DialogTitle>
							<DialogDescription>
								{editingProduct
									? 'Update product information'
									: 'Create a new product'}
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">Name</Label>
								<Input
									id="name"
									value={formData.name}
									onChange={(e) =>
										setFormData({ ...formData, name: e.target.value })
									}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="type">Product Type</Label>
								<Select
									value={formData.type}
									onValueChange={(value) =>
										setFormData({ 
											...formData, 
											type: value, 
											expireDays: value === 'key' ? formData.expireDays : '' // Clear expireDays if not key type
										})
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select product type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="key">Key</SelectItem>
										<SelectItem value="id">ID (Username/Password)</SelectItem>
										<SelectItem value="other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Input
									id="description"
									value={formData.description}
									onChange={(e) =>
										setFormData({ ...formData, description: e.target.value })
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="image">Image URL</Label>
								<Input
									id="image"
									type="url"
									placeholder="https://example.com/image.jpg"
									value={formData.image}
									onChange={(e) =>
										setFormData({ ...formData, image: e.target.value })
									}
								/>
								<p className="text-xs text-muted-foreground">
									Enter a URL to an image for the product cover
								</p>
							</div>
							<div className="space-y-2">
								<Label htmlFor="price">Price (THB)</Label>
								<Input
									id="price"
									type="number"
									step="0.01"
									min="0"
									value={formData.price}
									onChange={(e) =>
										setFormData({ ...formData, price: e.target.value })
									}
									required
								/>
							</div>
							
							{formData.type === 'key' ? (
								<div className="space-y-2">
									<Label htmlFor="expireDays">Expiration</Label>
									<Select
										value={formData.expireDays}
										onValueChange={(value) =>
											setFormData({ ...formData, expireDays: value })
										}
										required
									>
										<SelectTrigger>
											<SelectValue placeholder="Select expiration" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="1D">1 Day</SelectItem>
											<SelectItem value="7D">7 Days</SelectItem>
											<SelectItem value="30D">30 Days</SelectItem>
											<SelectItem value="Never">Never</SelectItem>
										</SelectContent>
									</Select>
									<div className="space-y-2 mt-4">
										<Label htmlFor="sourceCode">Source Code</Label>
										<textarea
											id="sourceCode"
											className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
											placeholder="Paste source code or script for this key product"
											value={formData.sourceCode}
											onChange={(e) =>
												setFormData({ ...formData, sourceCode: e.target.value })
											}
										/>
									</div>
								</div>
							) : (
								<>
									<div className="space-y-2">
										<Label htmlFor="stock">Stock</Label>
										<Input
											id="stock"
											type="number"
											min="0"
											value={formData.stock}
											onChange={(e) =>
												setFormData({ ...formData, stock: e.target.value })
											}
											required
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="category">Category</Label>
										<Input
											id="category"
											value={formData.category}
											onChange={(e) =>
												setFormData({ ...formData, category: e.target.value })
											}
										/>
									</div>
								</>
							)}
							
							<div className="flex items-center space-x-2">
								<input
									type="checkbox"
									id="isActive"
									checked={formData.isActive}
									onChange={(e) =>
										setFormData({ ...formData, isActive: e.target.checked })
									}
									className="h-4 w-4 rounded border-gray-300"
								/>
								<Label htmlFor="isActive">Active</Label>
							</div>
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => setIsDialogOpen(false)}
								>
									Cancel
								</Button>
								<Button type="submit">Save</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{products.map((product) => (
					<Card key={product.id}>
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
							<CardTitle>{product.name}</CardTitle>
							<CardDescription>{product.description}</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<p className="text-2xl font-bold text-primary">
									{formatCurrency(product.price)}
								</p>
								{product.type !== 'key' && (
									<p className="text-sm text-muted-foreground">
										Stock: {product.stock}
									</p>
								)}
								{product.type === 'key' && product.expireDays && (
									<p className="text-sm text-muted-foreground">
										Expires: {product.expireDays === 'Never' ? 'Never' : product.expireDays}
									</p>
								)}
								{product.type !== 'key' && product.category && (
									<p className="text-sm text-muted-foreground">
										Category: {product.category}
									</p>
								)}
								<p className="text-sm text-muted-foreground">
									Type: {product.type === 'key' ? 'Key' : product.type === 'id' ? 'ID (User/Pass)' : 'Other'}
								</p>
								<p className="text-sm text-muted-foreground">
									Status: {product.isActive ? 'Active' : 'Inactive'}
								</p>
							</div>
							<div className="flex space-x-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => handleOpenDialog(product)}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit
								</Button>
								<Button
									variant="destructive"
									size="sm"
									onClick={() => handleDelete(product.id)}
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</Button>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	)
}

