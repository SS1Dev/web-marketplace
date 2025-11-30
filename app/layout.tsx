import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/toaster'
import { StructuredData } from '@/components/seo/structured-data'

const inter = Inter({ subsets: ['latin'] })

const siteUrl = process.env.NEXTAUTH_URL || 'https://s1dev-shop.com'
const siteName = 'S1Dev Shop'
const siteDescription =
	'Your trusted marketplace for Roblox scripts, game keys, executor keys, and digital items. Fast delivery, secure payment with PromptPay, and instant access to your purchases.'

// ตาม Rules SEO: Meta title & description, keywords
export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),
	title: {
		default: 'S1Dev Shop - Buy Roblox Scripts, Game Keys & Executor Keys',
		template: '%s | S1Dev Shop',
	},
	description: siteDescription,
	keywords: [
		'roblox script',
		'roblox key',
		'gamepass code',
		'roblox item tools',
		'executor tools',
		'automation script',
		'roblox game utility',
		'buy roblox script',
		'roblox executor key',
		'digital game codes',
	],
	authors: [{ name: 'S1Dev' }],
	creator: 'S1Dev',
	publisher: 'S1Dev',
	formatDetection: {
		email: false,
		address: false,
		telephone: false,
	},
	// Open Graph สำหรับ social sharing
	openGraph: {
		type: 'website',
		locale: 'en_US',
		url: siteUrl,
		title: 'S1Dev Shop - Buy Roblox Scripts, Game Keys & Executor Keys',
		description: siteDescription,
		siteName: siteName,
		images: [
			{
				url: '/og-image.jpg',
				width: 1200,
				height: 630,
				alt: 'S1Dev Shop - Roblox Scripts & Game Keys Marketplace',
			},
		],
	},
	// Twitter Cards
	twitter: {
		card: 'summary_large_image',
		title: 'S1Dev Shop - Buy Roblox Scripts, Game Keys & Executor Keys',
		description: siteDescription,
		images: ['/og-image.jpg'],
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			'max-video-preview': -1,
			'max-image-preview': 'large',
			'max-snippet': -1,
		},
	},
	alternates: {
		canonical: siteUrl,
	},
	category: 'ecommerce',
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	// Organization Schema (ตาม Rules Structured Data)
	const organizationSchema = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: siteName,
		url: siteUrl,
		logo: `${siteUrl}/logo.png`,
		description: siteDescription,
		sameAs: [],
		contactPoint: {
			'@type': 'ContactPoint',
			contactType: 'customer service',
		},
	}

	// WebSite Schema with SearchAction (ตาม Rules)
	const websiteSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: siteName,
		url: siteUrl,
		description: siteDescription,
		potentialAction: {
			'@type': 'SearchAction',
			target: {
				'@type': 'EntryPoint',
				urlTemplate: `${siteUrl}/products?search={search_term_string}`,
			},
			'query-input': 'required name=search_term_string',
		},
	}

	return (
		<html lang="en" suppressHydrationWarning>
			<body className={inter.className}>
				<StructuredData data={[organizationSchema, websiteSchema]} />
				<Providers>
					{children}
					<Toaster />
				</Providers>
			</body>
		</html>
	)
}

