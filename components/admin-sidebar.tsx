'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
	LayoutDashboard,
	Package,
	Key,
	ArrowLeft,
} from 'lucide-react'

interface AdminSidebarProps {
	className?: string
}

const navigationItems = [
	{
		title: 'Dashboard',
		href: '/admin',
		icon: LayoutDashboard,
	},
	{
		title: 'Products',
		href: '/admin/products',
		icon: Package,
	},
	{
		title: 'Keys',
		href: '/admin/keys',
		icon: Key,
	},
]

export function AdminSidebar({ className }: AdminSidebarProps) {
	const pathname = usePathname()

	const isActiveRoute = (href: string) => {
		// For dashboard (exact path only)
		if (href === '/admin') {
			return pathname === '/admin'
		}
		// For other routes, check exact match or starts with
		return pathname === href || pathname.startsWith(href + '/')
	}

	return (
		<aside className={cn('w-64 border-r border-border bg-card p-6', className)}>
			<div className="space-y-8">
				<div>
					<h2 className="mb-4 text-lg font-semibold">Admin Panel</h2>
					<nav className="space-y-1">
						{navigationItems.map((item) => {
							const Icon = item.icon
							const isActive = isActiveRoute(item.href)
							return (
								<Link
									key={item.href}
									href={item.href}
									className={cn(
										'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
										isActive
											? 'bg-primary text-primary-foreground shadow-sm'
											: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
									)}
								>
									<Icon className={cn('h-5 w-5', isActive && 'text-primary-foreground')} />
									{item.title}
								</Link>
							)
						})}
					</nav>
				</div>
				<div className="border-t border-border pt-4">
					<Link
						href="/products"
						className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
					>
						<ArrowLeft className="h-5 w-5" />
						Back to Shop
					</Link>
				</div>
			</div>
		</aside>
	)
}
