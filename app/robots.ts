import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
	const baseUrl = process.env.NEXTAUTH_URL || 'https://s1dev-shop.com'

	return {
		rules: [
			{
				userAgent: '*',
				allow: '/',
				disallow: [
					'/api/',
					'/admin/',
					'/orders/',
					'/profile/',
					'/products/*/checkout/',
					'/products/*/payment/',
					'/login',
					'/register',
				],
			},
		],
		sitemap: `${baseUrl}/sitemap.xml`,
	}
}

