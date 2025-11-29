'use client'

import { ProductCard } from './product-card'
import type { Product } from '@prisma/client'

interface ProductGridProps {
	products: Product[]
}

export function ProductGrid({ products }: ProductGridProps) {
	if (products.length === 0) {
		return (
			<div className="text-center py-12">
				<p className="text-muted-foreground">No products available</p>
			</div>
		)
	}

	return (
		<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{products.map((product) => (
				<ProductCard key={product.id} product={product} />
			))}
		</div>
	)
}

