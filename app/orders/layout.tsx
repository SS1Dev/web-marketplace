import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'My Orders',
	description: 'View your order history and track the status of your purchases at S1Dev Shop.',
	robots: {
		index: false,
		follow: false,
	},
}

export default function OrdersLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return <>{children}</>
}

