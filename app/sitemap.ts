import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const baseUrl = process.env.NEXTAUTH_URL || 'https://s1dev-shop.com'

	// Static pages
	const staticPages: MetadataRoute.Sitemap = [
		{
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: 'daily',
			priority: 1,
		},
		{
			url: `${baseUrl}/products`,
			lastModified: new Date(),
			changeFrequency: 'daily',
			priority: 0.8,
		},
	]

	// Dynamic product pages
	try {
		const products = await prisma.product.findMany({
			where: { isActive: true },
			select: {
				id: true,
				updatedAt: true,
			},
		})

		const productPages: MetadataRoute.Sitemap = products.map((product) => ({
			url: `${baseUrl}/products/${product.id}`,
			lastModified: product.updatedAt,
			changeFrequency: 'weekly' as const,
			priority: 0.8,
		}))

		return [...staticPages, ...productPages]
	} catch (error) {
		console.error('Error generating sitemap:', error)
		return staticPages
	}
}

