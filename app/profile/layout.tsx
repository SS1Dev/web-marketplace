import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Profile',
	description: 'Manage your S1Dev Shop profile settings and account information.',
	robots: {
		index: false,
		follow: false,
	},
}

export default function ProfileLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return <>{children}</>
}

