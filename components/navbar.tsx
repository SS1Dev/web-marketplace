'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Package, User, LogOut, LayoutDashboard, Key } from 'lucide-react'

export function Navbar() {
	const { data: session } = useSession()

	return (
		<nav className="border-b border-border bg-card">
			<div className="container mx-auto px-4">
				<div className="flex h-16 items-center justify-between">
					<Link href="/products" className="flex items-center space-x-2">
						<Package className="h-6 w-6 text-primary" />
						<span className="text-xl font-bold">S1Dev Marketplace</span>
					</Link>

					<div className="flex items-center space-x-4">
						{session ? (
							<>
								<Link href="/products">
									<Button variant="ghost" size="sm">
										<Package className="mr-2 h-4 w-4" />
										Products
									</Button>
								</Link>
								{session.user?.role === 'admin' && (
									<>
										<Link href="/admin">
											<Button variant="ghost" size="sm">
												<LayoutDashboard className="mr-2 h-4 w-4" />
												Admin
											</Button>
										</Link>
										<Link href="/admin/keys">
											<Button variant="ghost" size="sm">
												<Key className="mr-2 h-4 w-4" />
												Keys
											</Button>
										</Link>
									</>
								)}
								<Link href="/profile">
									<Button variant="ghost" size="sm">
										<User className="mr-2 h-4 w-4" />
										{session.user?.name || session.user?.email}
									</Button>
								</Link>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => signOut()}
								>
									<LogOut className="mr-2 h-4 w-4" />
									Logout
								</Button>
							</>
						) : (
							<Link href="/login">
								<Button size="sm">Login</Button>
							</Link>
						)}
					</div>
				</div>
			</div>
		</nav>
	)
}

