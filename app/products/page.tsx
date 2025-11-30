import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/navbar'
import { ProductGrid } from '@/components/product-grid'
import { StructuredData } from '@/components/seo/structured-data'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const siteUrl = process.env.NEXTAUTH_URL || 'https://s1dev-shop.com'

// ตาม Rules SEO: Meta title, description, keywords
export const metadata: Metadata = {
	title: 'Products - Roblox Scripts, Game Keys & Executor Keys',
	description:
		'Browse our collection of Roblox scripts, game keys, executor keys, and digital items. Instant delivery, secure payment, and best prices guaranteed.',
	keywords: [
		'roblox script',
		'roblox key',
		'gamepass code',
		'roblox item tools',
		'executor tools',
		'automation script',
		'roblox game utility',
	],
	openGraph: {
		title: 'Products - S1Dev Shop',
		description:
			'Browse our collection of Roblox scripts, game keys, executor keys, and digital items. Instant delivery, secure payment, and best prices guaranteed.',
		url: `${siteUrl}/products`,
		type: 'website',
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Products - S1Dev Shop',
		description:
			'Browse our collection of Roblox scripts, game keys, executor keys, and digital items.',
	},
	alternates: {
		canonical: `${siteUrl}/products`,
	},
}

export default async function ProductsPage() {
	const products = await prisma.product.findMany({
		where: { isActive: true },
		orderBy: { createdAt: 'desc' },
	})

	// ItemList Schema สำหรับ SEO
	const itemListSchema = {
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		name: 'Roblox Scripts, Game Keys & Digital Items',
		description: 'Browse our collection of Roblox scripts, game keys, executor keys, and digital items',
		itemListElement: products.map((product, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			item: {
				'@type': 'Product',
				name: product.name,
				description: product.description || product.name,
				url: `${siteUrl}/products`,
				image: product.image || `${siteUrl}/placeholder-product.jpg`,
				offers: {
					'@type': 'Offer',
					price: product.price,
					priceCurrency: 'THB',
					availability:
						product.stock > 0 || product.type === 'key' || product.type === 'script'
							? 'https://schema.org/InStock'
							: 'https://schema.org/OutOfStock',
				},
			},
		})),
	}

	return (
		<div className="min-h-screen bg-background">
			<StructuredData data={itemListSchema} />
			<Navbar />
			<div className="container mx-auto px-4 py-8">
				<h1 className="mb-8 text-3xl font-bold">Products</h1>
				<ProductGrid products={products} />
			</div>
		</div>
	)
}

