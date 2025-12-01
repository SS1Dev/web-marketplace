'use client'

import { useState, useMemo } from 'react'
import { ProductCard } from './product-card'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Search, X, Filter } from 'lucide-react'
import { Button } from './ui/button'
import type { Product } from '@prisma/client'

interface ProductsListProps {
	products: Product[]
}

export function ProductsList({ products }: ProductsListProps) {
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedCategory, setSelectedCategory] = useState<string>('all')
	const [selectedType, setSelectedType] = useState<string>('all')
	const [sortBy, setSortBy] = useState<string>('newest')
	const [activeTab, setActiveTab] = useState<string>('all')

	// Extract unique categories from database only (exclude types)
	const categories = useMemo(() => {
		const validTypes = ['key', 'script', 'id', 'other']
		const cats = products
			.map((p) => p.category)
			.filter((cat): cat is string => {
				// Filter out null/undefined and exclude types that are mistakenly stored as categories
				if (!cat) return false
				// Exclude if category matches a type (case-insensitive)
				const catLower = cat.toLowerCase()
				return !validTypes.includes(catLower)
			})
		return Array.from(new Set(cats)).sort()
	}, [products])

	// Extract unique types from database only
	const availableTypes = useMemo(() => {
		const types = products.map((p) => p.type).filter((type): type is string => Boolean(type))
		return Array.from(new Set(types)).sort()
	}, [products])

	// Filter and sort products
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

		// Category filter - use activeTab if it's a category, otherwise use selectedCategory
		const effectiveCategory = activeTab !== 'all' && categories.includes(activeTab) ? activeTab : selectedCategory
		if (effectiveCategory !== 'all') {
			filtered = filtered.filter((product) => product.category === effectiveCategory)
		}

		// Type filter
		if (selectedType !== 'all') {
			filtered = filtered.filter((product) => product.type === selectedType)
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
	}, [products, searchQuery, selectedCategory, selectedType, sortBy, activeTab, categories])

	// Get products for display (no duplicate grouping)
	const displayProducts = useMemo(() => {
		return filteredProducts
	}, [filteredProducts])

	const clearFilters = () => {
		setSearchQuery('')
		setSelectedCategory('all')
		setSelectedType('all')
		setSortBy('newest')
		setActiveTab('all')
	}

	const hasActiveFilters = searchQuery || selectedCategory !== 'all' || selectedType !== 'all' || sortBy !== 'newest' || activeTab !== 'all'

	// Handle tab change - this is now the primary category filter
	const handleTabChange = (value: string) => {
		setActiveTab(value)
		// Sync selectedCategory for internal state consistency
		if (value !== 'all' && categories.includes(value)) {
			setSelectedCategory(value)
		} else {
			setSelectedCategory('all')
		}
	}

	return (
		<div className="space-y-8">
			{/* Search and Filters - Subtle, less prominent */}
			<div className="space-y-3 border-b border-border/40 pb-4">
				{/* Search Bar - Smaller, more subtle */}
				<div className="relative max-w-md">
					<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
					<Input
						type="text"
						placeholder="ค้นหาสินค้า..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="h-9 pl-8 pr-8 text-sm bg-muted/30 border-border/50 focus-visible:bg-background"
					/>
					{searchQuery && (
						<button
							onClick={() => setSearchQuery('')}
							className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground/70"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					)}
				</div>

				{/* Category Tabs - Primary category filter */}
				{categories.length > 0 && (
					<Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
						<TabsList className="flex-wrap h-auto gap-1 bg-muted/20 p-1">
							<TabsTrigger 
								value="all" 
								className="h-7 px-3 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
							>
								ทั้งหมด
								<Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
									{products.length}
								</Badge>
							</TabsTrigger>
							{categories.map((cat) => {
								const count = products.filter((p) => p.category === cat).length
								return (
									<TabsTrigger
										key={cat}
										value={cat}
										className="h-7 px-3 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
									>
										{cat}
										<Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
											{count}
										</Badge>
									</TabsTrigger>
								)
							})}
						</TabsList>
					</Tabs>
				)}

				{/* Filter Row - Compact, subtle (Type and Sort only) */}
				<div className="flex flex-nowrap gap-2 items-center justify-between text-xs">
					<div className="flex flex-nowrap gap-2 items-center">
						<div className="flex items-center gap-1.5 text-muted-foreground/70 whitespace-nowrap">
							<Filter className="h-3 w-3" />
							<span>กรอง:</span>
						</div>

						<Select value={selectedType} onValueChange={setSelectedType}>
							<SelectTrigger className="h-8 w-[120px] text-xs border-border/50 bg-muted/30">
								<SelectValue placeholder="ประเภท" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">ทั้งหมด</SelectItem>
								{availableTypes.map((type) => (
									<SelectItem key={type} value={type}>
										{type.charAt(0).toUpperCase() + type.slice(1)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select value={sortBy} onValueChange={setSortBy}>
							<SelectTrigger className="h-8 w-[130px] text-xs border-border/50 bg-muted/30">
								<SelectValue placeholder="เรียงตาม" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="newest">ใหม่ล่าสุด</SelectItem>
								<SelectItem value="oldest">เก่าที่สุด</SelectItem>
								<SelectItem value="name-asc">ชื่อ A-Z</SelectItem>
								<SelectItem value="name-desc">ชื่อ Z-A</SelectItem>
								<SelectItem value="price-asc">ราคาต่ำ-สูง</SelectItem>
								<SelectItem value="price-desc">ราคาสูง-ต่ำ</SelectItem>
							</SelectContent>
						</Select>

						{hasActiveFilters && (
							<Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-muted-foreground/70 hover:text-foreground whitespace-nowrap">
								<X className="mr-1.5 h-3 w-3" />
								ล้าง
							</Button>
						)}
					</div>

					{/* Results Count - Subtle */}
					<div className="text-xs text-muted-foreground/60 whitespace-nowrap flex-shrink-0">
						พบ <span className="font-medium text-foreground/80">{displayProducts.length}</span> รายการ
					</div>
				</div>
			</div>

			{/* Products Grid - Prominent, larger spacing */}
			<div>
				{displayProducts.length === 0 ? (
					<div className="text-center py-16">
						<p className="text-muted-foreground">ไม่พบสินค้าที่ค้นหา</p>
						{hasActiveFilters && (
							<Button variant="outline" className="mt-4" onClick={clearFilters}>
								ล้างตัวกรอง
							</Button>
						)}
					</div>
				) : (
					<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
						{displayProducts.map((product) => (
							<ProductCard key={product.id} product={product} />
						))}
					</div>
				)}
			</div>
		</div>
	)
}

