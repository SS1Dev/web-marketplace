import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { StructuredData } from './structured-data'

interface BreadcrumbItem {
	label: string
	href?: string
}

interface BreadcrumbsProps {
	items: BreadcrumbItem[]
	siteUrl?: string
}

export function Breadcrumbs({ items, siteUrl }: BreadcrumbsProps) {
	const baseUrl = siteUrl || process.env.NEXTAUTH_URL || 'https://s1dev-shop.com'

	// Breadcrumb structured data for SEO (ตาม Rules)
	const breadcrumbSchema = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{
				'@type': 'ListItem',
				position: 1,
				name: 'Home',
				item: baseUrl,
			},
			...items
				.filter((item) => item.href) // Only include items with href
				.map((item, index) => ({
					'@type': 'ListItem',
					position: index + 2,
					name: item.label,
					item: `${baseUrl}${item.href}`,
				})),
		],
	}

	return (
		<>
			<StructuredData data={breadcrumbSchema} />
			<nav aria-label="Breadcrumb" className="mb-6">
				<ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
					<li>
						<Link
							href="/products"
							className="flex items-center gap-1 transition-colors hover:text-foreground"
						>
							<Home className="h-4 w-4" />
							<span>Home</span>
						</Link>
					</li>
					{items.map((item, index) => (
						<li key={index} className="flex items-center gap-2">
							<ChevronRight className="h-4 w-4" />
							{item.href ? (
								<Link
									href={item.href}
									className="transition-colors hover:text-foreground"
								>
									{item.label}
								</Link>
							) : (
								<span className="text-foreground">{item.label}</span>
							)}
						</li>
					))}
				</ol>
			</nav>
		</>
	)
}

