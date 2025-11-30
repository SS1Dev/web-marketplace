import type { Metadata } from 'next'

const siteUrl = process.env.NEXTAUTH_URL || 'https://s1dev-shop.com'

export const metadata: Metadata = {
	title: 'Register',
	description:
		'Create a new S1Dev Shop account to start shopping for Roblox scripts, game keys, executor keys, and digital items.',
	robots: {
		index: false,
		follow: false,
	},
	alternates: {
		canonical: `${siteUrl}/register`,
	},
}

export default function RegisterLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return <>{children}</>
}

