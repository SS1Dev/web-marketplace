'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ShoppingCart, Package, User, LogOut, LayoutDashboard, Key, FileText, ChevronDown } from 'lucide-react'

export function Navbar() {
	const { data: session } = useSession()

	return (
		<nav className="border-b border-border bg-card">
			<div className="container mx-auto px-4">
				<div className="flex h-16 items-center justify-between">
					<Link href="/" className="flex items-center space-x-2">
						<Package className="h-6 w-6 text-primary" />
						<span className="text-xl font-bold">S1Dev Shop</span>
					</Link>

					<div className="flex items-center space-x-4">
						{/* Products menu - แสดงตลอดเวลา */}
						<Link href="/products">
							<Button variant="ghost" size="sm">
								<Package className="mr-2 h-4 w-4" />
								Products
							</Button>
						</Link>

						{session ? (
							<>
								{/* Admin Menu Dropdown */}
								{session.user?.role === 'admin' && (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="sm">
												<LayoutDashboard className="mr-2 h-4 w-4" />
												Admin
												<ChevronDown className="ml-2 h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" className="w-48">
											<DropdownMenuLabel>Admin Panel</DropdownMenuLabel>
											<DropdownMenuSeparator />
											<DropdownMenuItem asChild>
												<Link href="/admin" className="flex items-center">
													<LayoutDashboard className="mr-2 h-4 w-4" />
													Dashboard
												</Link>
											</DropdownMenuItem>
											<DropdownMenuItem asChild>
												<Link href="/admin/products" className="flex items-center">
													<Package className="mr-2 h-4 w-4" />
													Products
												</Link>
											</DropdownMenuItem>
											<DropdownMenuItem asChild>
												<Link href="/admin/keys" className="flex items-center">
													<Key className="mr-2 h-4 w-4" />
													Keys
												</Link>
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								)}

								{/* User Profile Menu Dropdown */}
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="sm">
											<User className="mr-2 h-4 w-4" />
											{session.user?.name || session.user?.email}
											<ChevronDown className="ml-2 h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-56">
										<DropdownMenuLabel>
											<div className="flex flex-col space-y-1">
												<p className="text-sm font-medium leading-none">
													{session.user?.name || 'User'}
												</p>
												<p className="text-xs leading-none text-muted-foreground">
													{session.user?.email}
												</p>
											</div>
										</DropdownMenuLabel>
										<DropdownMenuSeparator />
										<DropdownMenuItem asChild>
											<Link href="/profile" className="flex items-center">
												<User className="mr-2 h-4 w-4" />
												Profile
											</Link>
										</DropdownMenuItem>
										<DropdownMenuItem asChild>
											<Link href="/orders" className="flex items-center">
												<FileText className="mr-2 h-4 w-4" />
												My Orders
											</Link>
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onClick={() => signOut()}
											className="text-destructive focus:text-destructive"
										>
											<LogOut className="mr-2 h-4 w-4" />
											Logout
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
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

