import type { Metadata } from 'next'

const siteUrl = process.env.NEXTAUTH_URL || 'https://s1dev-shop.com'

export const metadata: Metadata = {
	title: 'Login',
	description: 'Sign in to your S1Dev Shop account to browse and purchase Roblox scripts, game keys, and digital items.',
	robots: {
		index: false,
		follow: false,
	},
	alternates: {
		canonical: `${siteUrl}/login`,
	},
}

export default function LoginLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return <>{children}</>
}

