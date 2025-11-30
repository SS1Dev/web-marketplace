'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import type { Product } from '@prisma/client'
import { Plus, Edit, Trash2, Search, Filter, X } from 'lucide-react'
import { AdminProductCard } from './admin-product-card'
import { Badge } from '@/components/ui/badge'

interface ProductManagementProps {
	products: Product[]
}

export function ProductManagement({ products: initialProducts }: ProductManagementProps) {
	const router = useRouter()
	const { toast } = useToast()
	const [products] = useState(initialProducts)
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [editingProduct, setEditingProduct] = useState<Product | null>(null)
	const [searchQuery, setSearchQuery] = useState('')
	const [filterType, setFilterType] = useState<string>('all')
	const [filterStatus, setFilterStatus] = useState<string>('all')
	const [sortBy, setSortBy] = useState<string>('newest')
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

		// Validation
		if (!formData.name.trim()) {
			toast({
				title: 'Error',
				description: 'Product name is required',
				variant: 'destructive',
			})
			return
		}

		if (!formData.price || parseFloat(formData.price) < 0) {
			toast({
				title: 'Error',
				description: 'Valid price is required',
				variant: 'destructive',
			})
			return
		}

		if (formData.type === 'key' && !formData.expireDays) {
			toast({
				title: 'Error',
				description: 'Expiration is required for key products',
				variant: 'destructive',
			})
			return
		}

		// Validate stock for other and id types
		if (formData.type === 'other' || formData.type === 'id') {
			const stockValue = parseInt(formData.stock)
			if (!formData.stock || isNaN(stockValue) || stockValue < 0) {
				toast({
					title: 'Error',
					description: 'Valid stock quantity is required',
					variant: 'destructive',
				})
				return
			}
		}

		try {
			const url = editingProduct
				? `/api/admin/products/${editingProduct.id}`
				: '/api/admin/products'
			const method = editingProduct ? 'PUT' : 'POST'

			// Prepare request body
			const requestBody: any = {
				name: formData.name.trim(),
				description: formData.description.trim() || undefined,
				price: parseFloat(formData.price),
				stock: (formData.type === 'key' || formData.type === 'script') 
					? 0 
					: parseInt(formData.stock) || 0,
				category: formData.category.trim() || undefined,
				type: formData.type,
				image: formData.image.trim() || null,
				isActive: formData.isActive,
			}

			// Only include expireDays if type is 'key'
			if (formData.type === 'key') {
				requestBody.expireDays = formData.expireDays || null
			} else {
				requestBody.expireDays = null
			}

			// Include sourceCode for 'script' or 'key' type products
			if (formData.type === 'script' || formData.type === 'key') {
				requestBody.sourceCode = formData.sourceCode.trim() || null
			} else {
				requestBody.sourceCode = null
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
				// Show detailed error if available
				if (data.details && Array.isArray(data.details)) {
					const errorMessages = data.details.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ')
					throw new Error(errorMessages || data.error || 'Failed to save product')
				}
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

	const handleToggleActive = async (productId: string, isActive: boolean) => {
		try {
			const response = await fetch(`/api/admin/products/${productId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ isActive }),
			})

			if (!response.ok) {
				const data = await response.json()
				throw new Error(data.error || 'Failed to update product status')
			}

			toast({
				title: 'Success',
				description: `Product ${isActive ? 'activated' : 'deactivated'} successfully`,
				variant: 'success',
			})

			router.refresh()
		} catch (error) {
			toast({
				title: 'Error',
				description: error instanceof Error ? error.message : 'Something went wrong',
				variant: 'destructive',
			})
			throw error // Re-throw to allow card to revert state
		}
	}

	// Filter and search products
	const filteredProducts = useMemo(() => {
		let filtered = [...products]

		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase()
			filtered = filtered.filter(
				(product) =>
					product.name.toLowerCase().includes(query) ||
					product.description?.toLowerCase().includes(query) ||
					product.category?.toLowerCase().includes(query)
			)
		}

		// Type filter
		if (filterType !== 'all') {
			filtered = filtered.filter((product) => product.type === filterType)
		}

		// Status filter
		if (filterStatus !== 'all') {
			const isActive = filterStatus === 'active'
			filtered = filtered.filter((product) => product.isActive === isActive)
		}

		// Sort
		switch (sortBy) {
			case 'newest':
				filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
				break
			case 'oldest':
				filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
				break
			case 'name-asc':
				filtered.sort((a, b) => a.name.localeCompare(b.name))
				break
			case 'name-desc':
				filtered.sort((a, b) => b.name.localeCompare(a.name))
				break
			case 'price-asc':
				filtered.sort((a, b) => a.price - b.price)
				break
			case 'price-desc':
				filtered.sort((a, b) => b.price - a.price)
				break
		}

		return filtered
	}, [products, searchQuery, filterType, filterStatus, sortBy])

	const activeFiltersCount = [filterType, filterStatus].filter((f) => f !== 'all').length

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Products</h1>
					<p className="text-muted-foreground mt-1">Manage your product catalog</p>
				</div>
				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button onClick={() => handleOpenDialog()}>
							<Plus className="mr-2 h-4 w-4" />
							Add Product
						</Button>
					</DialogTrigger>
					<DialogContent className="max-h-[90vh] flex flex-col">
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
						<div className="overflow-y-auto flex-1 px-1">
							<form onSubmit={handleSubmit} className="space-y-4" id="product-form">
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
									onValueChange={(value) => {
										// Reset fields based on type
										const updates: any = { type: value }
										
										if (value !== 'key') {
											updates.expireDays = ''
										}
										
										if (value === 'key' || value === 'script') {
											updates.stock = '0'
										} else if (value === 'other' || value === 'id') {
											// Keep stock if it has a value, otherwise set to empty
											if (!formData.stock || formData.stock === '0') {
												updates.stock = ''
											}
										}
										
										// Clear sourceCode only if changing to types that don't support it (other/id)
										if (value !== 'script' && value !== 'key') {
											updates.sourceCode = ''
										}
										
										setFormData({ ...formData, ...updates })
									}}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select product type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="key">Key</SelectItem>
										<SelectItem value="id">ID (Username/Password)</SelectItem>
										<SelectItem value="script">Script</SelectItem>
										<SelectItem value="other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<textarea
									id="description"
									className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
									placeholder="Enter product description"
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
							
							{formData.type === 'key' && (
								<>
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
									</div>
									<div className="space-y-2">
										<Label htmlFor="sourceCode">Source Code</Label>
										<textarea
											id="sourceCode"
											className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
											placeholder="Paste source code or key information for this product"
											value={formData.sourceCode}
											onChange={(e) =>
												setFormData({ ...formData, sourceCode: e.target.value })
											}
										/>
									</div>
								</>
							)}
							
							{formData.type === 'script' && (
								<div className="space-y-2">
									<Label htmlFor="sourceCode">Source Code</Label>
									<textarea
										id="sourceCode"
										className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
										placeholder="Paste source code or script for this product"
										value={formData.sourceCode}
										onChange={(e) =>
											setFormData({ ...formData, sourceCode: e.target.value })
										}
									/>
								</div>
							)}
							
							{(formData.type === 'other' || formData.type === 'id') && (
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
										required={formData.type === 'other' || formData.type === 'id'}
									/>
									<p className="text-xs text-muted-foreground">
										Required for {formData.type === 'other' ? 'other' : 'ID'} products
									</p>
								</div>
							)}
							
							<div className="space-y-2">
								<Label htmlFor="category">Category</Label>
								<Input
									id="category"
									value={formData.category}
									onChange={(e) =>
										setFormData({ ...formData, category: e.target.value })
									}
									placeholder="Enter product category (optional)"
								/>
							</div>
							
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
							</form>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" form="product-form">Save</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{/* Search and Filters */}
			<Card>
				<CardContent className="pt-6">
					<div className="space-y-4">
						{/* Search */}
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search products by name, description, or category..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10"
							/>
							{searchQuery && (
								<Button
									variant="ghost"
									size="icon"
									className="absolute right-1 top-1/2 -translate-y-1/2"
									onClick={() => setSearchQuery('')}
								>
									<X className="h-4 w-4" />
								</Button>
							)}
						</div>

						{/* Filters */}
						<div className="flex flex-wrap gap-4">
							<div className="flex items-center gap-2">
								<Filter className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm font-medium">Filters:</span>
							</div>
							<div className="flex-1">
								<Select value={filterType} onValueChange={setFilterType}>
									<SelectTrigger className="w-[180px]">
										<SelectValue placeholder="Product Type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Types</SelectItem>
										<SelectItem value="key">Key</SelectItem>
										<SelectItem value="script">Script</SelectItem>
										<SelectItem value="id">ID</SelectItem>
										<SelectItem value="other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Select value={filterStatus} onValueChange={setFilterStatus}>
									<SelectTrigger className="w-[150px]">
										<SelectValue placeholder="Status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Status</SelectItem>
										<SelectItem value="active">Active</SelectItem>
										<SelectItem value="inactive">Inactive</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Select value={sortBy} onValueChange={setSortBy}>
									<SelectTrigger className="w-[180px]">
										<SelectValue placeholder="Sort by" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="newest">Newest First</SelectItem>
										<SelectItem value="oldest">Oldest First</SelectItem>
										<SelectItem value="name-asc">Name (A-Z)</SelectItem>
										<SelectItem value="name-desc">Name (Z-A)</SelectItem>
										<SelectItem value="price-asc">Price (Low to High)</SelectItem>
										<SelectItem value="price-desc">Price (High to Low)</SelectItem>
									</SelectContent>
								</Select>
							</div>
							{(searchQuery || activeFiltersCount > 0) && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										setSearchQuery('')
										setFilterType('all')
										setFilterStatus('all')
										setSortBy('newest')
									}}
								>
									<X className="mr-2 h-4 w-4" />
									Clear Filters
								</Button>
							)}
						</div>

						{/* Results count */}
						<div className="flex items-center justify-between text-sm text-muted-foreground">
							<span>
								Showing {filteredProducts.length} of {products.length} products
							</span>
							{(searchQuery || activeFiltersCount > 0) && (
								<div className="flex items-center gap-2">
									{searchQuery && (
										<Badge variant="secondary" className="gap-1">
											Search: {searchQuery}
											<X
												className="h-3 w-3 cursor-pointer"
												onClick={() => setSearchQuery('')}
											/>
										</Badge>
									)}
									{filterType !== 'all' && (
										<Badge variant="secondary" className="gap-1">
											Type: {filterType}
											<X
												className="h-3 w-3 cursor-pointer"
												onClick={() => setFilterType('all')}
											/>
										</Badge>
									)}
									{filterStatus !== 'all' && (
										<Badge variant="secondary" className="gap-1">
											Status: {filterStatus}
											<X
												className="h-3 w-3 cursor-pointer"
												onClick={() => setFilterStatus('all')}
											/>
										</Badge>
									)}
								</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Products Grid */}
			{filteredProducts.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<p className="text-muted-foreground">No products found. Try adjusting your filters.</p>
					</CardContent>
				</Card>
			) : (
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{filteredProducts.map((product) => (
						<AdminProductCard
							key={product.id}
							product={product}
							onEdit={() => handleOpenDialog(product)}
							onDelete={() => handleDelete(product.id)}
							onToggleActive={handleToggleActive}
						/>
					))}
				</div>
			)}
		</div>
	)
}

