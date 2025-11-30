'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

function LoginForm() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const { toast } = useToast()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [isLoading, setIsLoading] = useState(false)

	// Get callback URL from query params
	const callbackUrl = searchParams?.get('callbackUrl') || '/products'

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsLoading(true)

		try {
			const result = await signIn('credentials', {
				email,
				password,
				redirect: false,
			})

			if (result?.error) {
				toast({
					title: 'Error',
					description: 'Invalid email or password',
					variant: 'destructive',
				})
			} else {
				router.push(callbackUrl)
				router.refresh()
			}
		} catch (error) {
			toast({
				title: 'Error',
				description: 'Something went wrong',
				variant: 'destructive',
			})
		} finally {
			setIsLoading(false)
		}
	}

	const handleDiscordLogin = async () => {
		setIsLoading(true)
		try {
			const result = await signIn('discord', {
				callbackUrl: callbackUrl,
				redirect: false,
			})

			if (result?.error) {
				if (result.error === 'OAuthAccountNotLinked') {
					toast({
						title: 'Account Not Linked',
						description:
							'An account with this email already exists. Please sign in with your email and password, or use a different Discord account.',
						variant: 'destructive',
					})
				} else {
					toast({
						title: 'Error',
						description: result.error || 'Failed to sign in with Discord',
						variant: 'destructive',
					})
				}
			} else if (result?.ok) {
				router.push(callbackUrl)
				router.refresh()
			}
		} catch (error) {
			toast({
				title: 'Error',
				description: 'Something went wrong',
				variant: 'destructive',
			})
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="text-2xl">Welcome Back</CardTitle>
					<CardDescription>
						Sign in to your account to continue
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								placeholder="your@email.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								placeholder="••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
						</div>
						<Button
							type="submit"
							className="w-full"
							disabled={isLoading}
						>
							{isLoading ? 'Signing in...' : 'Sign In'}
						</Button>
					</form>

					<div className="mt-6">
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<span className="w-full border-t" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-card px-2 text-muted-foreground">
									Or continue with
								</span>
							</div>
						</div>

						<Button
							variant="outline"
							className="mt-4 w-full"
							onClick={handleDiscordLogin}
							disabled={isLoading}
						>
							<svg
								className="mr-2 h-4 w-4"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
							</svg>
							Discord
						</Button>
					</div>

					<div className="mt-4 text-center text-sm">
						<span className="text-muted-foreground">Don&apos;t have an account? </span>
						<Link href="/register" className="text-primary hover:underline">
							Register
						</Link>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

export default function LoginPage() {
	return (
		<Suspense fallback={
			<div className="flex min-h-screen items-center justify-center bg-background p-4">
				<Card className="w-full max-w-md">
					<CardContent className="py-12">
						<div className="text-center">
							<p className="text-muted-foreground">Loading...</p>
						</div>
					</CardContent>
				</Card>
			</div>
		}>
			<LoginForm />
		</Suspense>
	)
}
