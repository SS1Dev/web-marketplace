'use client'

import { AdminSidebar } from './admin-sidebar'
import { Navbar } from './navbar'

interface AdminLayoutProps {
	children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
	return (
		<div className="min-h-screen bg-background">
			<Navbar />
			<div className="flex">
				<AdminSidebar className="hidden lg:block fixed left-0 top-16 h-[calc(100vh-4rem)] overflow-y-auto" />
				<main className="flex-1 lg:ml-64">
					<div className="container mx-auto px-4 py-8">
						{children}
					</div>
				</main>
			</div>
		</div>
	)
}

