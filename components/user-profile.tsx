'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Loader2, User as UserIcon, Lock, ShoppingBag, Grid3x3, Table2, Filter } from 'lucide-react'
import { OrderHistory } from '@/components/order-history'
import type { User, Order, OrderItem } from '@prisma/client'

interface UserProfileProps {
	user: User
	orders: (Order & {
		items: OrderItem[]
	})[]
}

export function UserProfile({ user: initialUser, orders: initialOrders }: UserProfileProps) {
	const { data: session, update } = useSession()
	const router = useRouter()
	const { toast } = useToast()
	const [user, setUser] = useState(initialUser)
	const [isUpdatingName, setIsUpdatingName] = useState(false)
	const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
	const [name, setName] = useState(user.name || '')
	const [currentPassword, setCurrentPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')

	const handleUpdateName = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsUpdatingName(true)

		try {
			const response = await fetch('/api/user/profile', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: name.trim(),
				}),
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Failed to update name')
			}

			setUser({ ...user, name: name.trim() })
			await update() // Update session
			router.refresh()

			toast({
				title: 'Success',
				description: 'Display name updated successfully',
				variant: 'success',
			})
		} catch (error) {
			toast({
				title: 'Error',
				description: error instanceof Error ? error.message : 'Something went wrong',
				variant: 'destructive',
			})
		} finally {
			setIsUpdatingName(false)
		}
	}

	const handleUpdatePassword = async (e: React.FormEvent) => {
		e.preventDefault()

		if (newPassword !== confirmPassword) {
			toast({
				title: 'Error',
				description: 'New passwords do not match',
				variant: 'destructive',
			})
			return
		}

		setIsUpdatingPassword(true)

		try {
			const response = await fetch('/api/user/profile', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					currentPassword,
					newPassword,
				}),
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Failed to update password')
			}

			setCurrentPassword('')
			setNewPassword('')
			setConfirmPassword('')

			toast({
				title: 'Success',
				description: 'Password updated successfully',
				variant: 'success',
			})
		} catch (error) {
			toast({
				title: 'Error',
				description: error instanceof Error ? error.message : 'Something went wrong',
				variant: 'destructive',
			})
		} finally {
			setIsUpdatingPassword(false)
		}
	}

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<h1 className="text-3xl font-bold">User Profile</h1>

			<Tabs defaultValue="profile" className="space-y-6">
				<TabsList>
					<TabsTrigger value="profile">
						<UserIcon className="mr-2 h-4 w-4" />
						Profile
					</TabsTrigger>
					<TabsTrigger value="password">
						<Lock className="mr-2 h-4 w-4" />
						Password
					</TabsTrigger>
					<TabsTrigger value="orders">
						<ShoppingBag className="mr-2 h-4 w-4" />
						Order History
					</TabsTrigger>
				</TabsList>

				<TabsContent value="profile" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Display Name</CardTitle>
							<CardDescription>
								Update your display name
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleUpdateName} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="name">Display Name</Label>
									<Input
										id="name"
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="Enter your display name"
										required
									/>
								</div>
								<Button type="submit" disabled={isUpdatingName}>
									{isUpdatingName ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Updating...
										</>
									) : (
										'Update Name'
									)}
								</Button>
							</form>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Account Information</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							<div>
								<Label className="text-muted-foreground">Email</Label>
								<p className="text-sm font-medium">{user.email}</p>
							</div>
							<div>
								<Label className="text-muted-foreground">Role</Label>
								<p className="text-sm font-medium capitalize">{user.role}</p>
							</div>
							<div>
								<Label className="text-muted-foreground">Member Since</Label>
								<p className="text-sm font-medium">
									{new Date(user.createdAt).toLocaleDateString()}
								</p>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="password" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Change Password</CardTitle>
							<CardDescription>
								Update your password to keep your account secure
							</CardDescription>
						</CardHeader>
						<CardContent>
							{!user.password ? (
								<p className="text-sm text-muted-foreground">
									You signed in with Discord. Password change is not available for OAuth accounts.
								</p>
							) : (
								<form onSubmit={handleUpdatePassword} className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="currentPassword">Current Password</Label>
										<Input
											id="currentPassword"
											type="password"
											value={currentPassword}
											onChange={(e) => setCurrentPassword(e.target.value)}
											placeholder="Enter current password"
											required
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="newPassword">New Password</Label>
										<Input
											id="newPassword"
											type="password"
											value={newPassword}
											onChange={(e) => setNewPassword(e.target.value)}
											placeholder="Enter new password (min 6 characters)"
											required
											minLength={6}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="confirmPassword">Confirm New Password</Label>
										<Input
											id="confirmPassword"
											type="password"
											value={confirmPassword}
											onChange={(e) => setConfirmPassword(e.target.value)}
											placeholder="Confirm new password"
											required
											minLength={6}
										/>
									</div>
									<Button type="submit" disabled={isUpdatingPassword}>
										{isUpdatingPassword ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Updating...
											</>
										) : (
											'Update Password'
										)}
									</Button>
								</form>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="orders" className="space-y-4">
					<OrderHistory orders={initialOrders} />
				</TabsContent>
			</Tabs>
		</div>
	)
}

