'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Loader2, CheckCircle2, XCircle, X, Clock, AlertCircle, QrCode, Shield, CreditCard, ShoppingCart } from 'lucide-react'
import type { Order, OrderItem, Product, User } from '@prisma/client'

interface PaymentPageProps {
	order: Order & {
		items: (OrderItem & {
			productData?: any // Embedded product data
		})[]
	}
}

export function PaymentPage({ order }: PaymentPageProps) {
	const router = useRouter()
	const { toast } = useToast()
	const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isPolling, setIsPolling] = useState(false)
	const [isCancelling, setIsCancelling] = useState(false)
	const [chargeStatus, setChargeStatus] = useState<string | null>(null)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [qrExpiresAt, setQrExpiresAt] = useState<Date | null>(null)
	const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
	const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const isInitializingRef = useRef(false) // Prevent duplicate initialization
	const hasMountedRef = useRef(false) // Track if component has mounted

	const startPolling = useCallback(() => {
		if (pollingIntervalRef.current) {
			clearInterval(pollingIntervalRef.current)
		}
		if (pollingTimeoutRef.current) {
			clearTimeout(pollingTimeoutRef.current)
		}

		setIsPolling(true)
		
		// Automatic polling every 10 seconds
		// Webhook will handle real-time updates, polling is just a backup
		const pollingInterval = 10000 // Poll every 10 seconds
		let pollCount = 0 // Track number of polls for fallback logic
		
		pollingIntervalRef.current = setInterval(async () => {
			try {
				pollCount++
				
				// After 3 polls (30 seconds), always request refresh from Omise as fallback
				// This ensures we check Omise directly if webhook is delayed or failed
				const shouldRefresh = pollCount >= 3 || pollCount % 3 === 0 // Refresh every 3rd poll (every 30 seconds)
				
				const response = await fetch(
					`/api/payments/status?orderId=${order.id}${shouldRefresh ? '&refresh=true' : ''}`
				)
				const data = await response.json()

				// Update charge status and expiration
				if (data.status) {
					setChargeStatus(data.status)
				}
				if (data.expires_at) {
					setQrExpiresAt(new Date(data.expires_at))
				}

				// Check if order is cancelled (from orderStatus)
				if (data.orderStatus === 'cancelled' || order.status === 'cancelled') {
					if (pollingIntervalRef.current) {
						clearInterval(pollingIntervalRef.current)
						pollingIntervalRef.current = null
					}
					if (pollingTimeoutRef.current) {
						clearTimeout(pollingTimeoutRef.current)
						pollingTimeoutRef.current = null
					}
					setIsPolling(false)
					
					toast({
						title: 'Order Cancelled',
						description: 'This order has been cancelled. Redirecting...',
						variant: 'destructive',
					})
					
					// Use window.location for more reliable redirect
					window.location.href = `/orders/${order.id}`
					return
				}

				// Handle successful payment
				// Check multiple conditions: status, paid flag, or order status from response
				const isPaid = 
					data.paid === true || 
					data.status === 'paid' || 
					data.status === 'completed' ||
					data.status === 'successful' ||
					(data.orderStatus && (data.orderStatus === 'paid' || data.orderStatus === 'completed'))

				if (isPaid) {
					if (pollingIntervalRef.current) {
						clearInterval(pollingIntervalRef.current)
						pollingIntervalRef.current = null
					}
					if (pollingTimeoutRef.current) {
						clearTimeout(pollingTimeoutRef.current)
						pollingTimeoutRef.current = null
					}
					setIsPolling(false)
					
					toast({
						title: 'Payment Successful',
						description: 'Your payment has been confirmed. Redirecting...',
					})
					
					// Use window.location for more reliable redirect
					window.location.href = `/orders/${order.id}`
					return
				}

				// Handle failed, cancelled, or expired payment
				if (data.status === 'failed' || data.status === 'cancelled' || data.status === 'expired') {
					if (pollingIntervalRef.current) {
						clearInterval(pollingIntervalRef.current)
					}
					setIsPolling(false)
					
					let errorMsg = 'Payment failed or was cancelled. Please try again or contact support.'
					if (data.status === 'expired') {
						errorMsg = 'QR code has expired. Please create a new payment request.'
					} else if (data.status === 'failed') {
						errorMsg = 'Payment failed. Please check your account balance and try again.'
					}
					
					setErrorMessage(errorMsg)
					toast({
						title: 'Payment Status',
						description: errorMsg,
						variant: 'destructive',
					})
				}
			} catch {
				// Don't stop polling on temporary errors
				// If error persists, we can add retry logic or fallback to manual refresh
				
				// After 5 consecutive errors, try a direct refresh from Omise
				if (pollCount >= 5 && pollCount % 5 === 0) {
					try {
						const refreshResponse = await fetch(`/api/payments/status?orderId=${order.id}&refresh=true`)
						const refreshData = await refreshResponse.json()
						
						if (refreshData.paid || refreshData.status === 'paid') {
							// Payment was successful, handle it
							if (pollingIntervalRef.current) {
								clearInterval(pollingIntervalRef.current)
								pollingIntervalRef.current = null
							}
							setIsPolling(false)
							toast({
								title: 'Payment Successful',
								description: 'Your payment has been confirmed',
							})
							window.location.href = `/orders/${order.id}`
						}
					} catch {
						// Ignore refresh errors
					}
				}
			}
		}, pollingInterval)

		// Stop polling after 10 minutes (QR code expires in 24 hours, but stop polling earlier)
		pollingTimeoutRef.current = setTimeout(() => {
			if (pollingIntervalRef.current) {
				clearInterval(pollingIntervalRef.current)
			}
			setIsPolling(false)
		}, 600000)
	}, [order.id, order.status, toast])

	const initializePayment = useCallback(async () => {
		// Prevent duplicate calls
		if (isInitializingRef.current) {
			return
		}

		// Check if already has charge ID (prevent duplicate)
		if (order.omiseChargeId) {
			setQrCodeUrl(order.qrCodeUrl || null)
			setIsLoading(false)
			return
		}

		isInitializingRef.current = true
		setIsLoading(true)

		try {
			const response = await fetch(`/api/payments/create`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					orderId: order.id,
					amount: order.totalAmount,
				}),
			})

			const data = await response.json()

			if (!response.ok) {
				// If order status changed, refresh the page to show updated status
				if (response.status === 409 && data.status) {
					// Order status changed (paid, cancelled, etc.)
					router.refresh()
					toast({
						title: 'Order Status Updated',
						description: data.message || `Order is now ${data.status}. Refreshing page...`,
					})
					// Redirect to order detail page after a short delay
					setTimeout(() => {
						router.push(`/orders/${order.id}`)
					}, 1500)
					return
				}

				// Handle validation errors (amount limits, etc.)
				const errorMsg = data.error || 'Failed to initialize payment'
				setErrorMessage(errorMsg)
				toast({
					title: 'Payment Error',
					description: errorMsg,
					variant: 'destructive',
				})
				throw new Error(errorMsg)
			}

			// Set QR code URL and charge status
			setQrCodeUrl(data.qrCodeUrl)
			if (data.status) {
				setChargeStatus(data.status)
			}

			// Set QR code expiration from API response or calculate default (24 hours from now)
			if (data.expires_at) {
				setQrExpiresAt(new Date(data.expires_at))
			} else {
				// Fallback: Calculate QR code expiration (24 hours from now according to Omise PromptPay)
				const expiresAt = new Date()
				expiresAt.setHours(expiresAt.getHours() + 24)
				setQrExpiresAt(expiresAt)
			}

			setErrorMessage(null)
			setIsLoading(false)
			startPolling()
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Failed to initialize payment'
			if (!errorMsg.includes('Order Status Updated')) {
				setErrorMessage(errorMsg)
				toast({
					title: 'Error',
					description: errorMsg,
					variant: 'destructive',
				})
			}
			setIsLoading(false)
			isInitializingRef.current = false // Reset on error to allow retry
		}
		}, [order.id, order.totalAmount, order.omiseChargeId, order.qrCodeUrl, startPolling, toast, router])

	useEffect(() => {
		// Prevent double execution in React Strict Mode
		if (hasMountedRef.current) {
			return
		}
		hasMountedRef.current = true

			// Only run once on mount
			// Check if order is already paid or cancelled - if so, redirect immediately
			if (order.status === 'paid' || order.status === 'completed') {
				toast({
					title: 'Payment Confirmed',
					description: 'Your payment has been confirmed',
				})
				// Use window.location for more reliable redirect
				window.location.href = `/orders/${order.id}`
				return
			}

			if (order.status === 'cancelled') {
				toast({
					title: 'Order Cancelled',
					description: 'This order has been cancelled',
					variant: 'destructive',
				})
				// Use window.location for more reliable redirect
				window.location.href = `/orders/${order.id}`
				return
			}

			if (order.omiseChargeId && order.qrCodeUrl) {
				// Payment already initialized
				setQrCodeUrl(order.qrCodeUrl)
				setChargeStatus('pending') // Default to pending if we have QR code
				setIsLoading(false)
				
				// Calculate QR code expiration (24 hours from order creation, or use expires_at if available)
				const expiresAt = new Date(order.createdAt)
				expiresAt.setHours(expiresAt.getHours() + 24)
				setQrExpiresAt(expiresAt)

				if (order.status === 'pending') {
					startPolling()
				} else if (order.status === 'cancelled') {
					// Order is cancelled, redirect to order detail
					toast({
						title: 'Order Cancelled',
						description: 'This order has been cancelled',
						variant: 'destructive',
					})
					window.location.href = `/orders/${order.id}`
				}
		} else if (!isInitializingRef.current && !qrCodeUrl && !order.omiseChargeId) {
			// Only initialize if:
			// - Not already initializing
			// - No QR code yet
			// - No charge ID yet
			initializePayment()
		}

		return () => {
			if (pollingIntervalRef.current) {
				clearInterval(pollingIntervalRef.current)
			}
			if (pollingTimeoutRef.current) {
				clearTimeout(pollingTimeoutRef.current)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []) // Only run once on mount

	const handleCancel = async () => {
		if (!confirm('Are you sure you want to cancel this order?')) {
			return
		}

		setIsCancelling(true)

		// Stop polling if active
		if (pollingIntervalRef.current) {
			clearInterval(pollingIntervalRef.current)
			pollingIntervalRef.current = null
		}
		if (pollingTimeoutRef.current) {
			clearTimeout(pollingTimeoutRef.current)
			pollingTimeoutRef.current = null
		}
		setIsPolling(false)

		try {
			const response = await fetch(`/api/orders/${order.id}/cancel`, {
				method: 'POST',
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Failed to cancel order')
			}

			toast({
				title: 'Success',
				description: 'Order cancelled successfully',
				variant: 'success',
			})

			router.push(`/orders/${order.id}`)
			router.refresh()
		} catch (error) {
			toast({
				title: 'Error',
				description: error instanceof Error ? error.message : 'Something went wrong',
				variant: 'destructive',
			})
			setIsCancelling(false)
		}
	}

	return (
		<div className="mx-auto max-w-6xl px-4 py-8">
			<div className="mb-8">
				<h1 className="text-3xl font-bold tracking-tight mb-2">Payment</h1>
				<p className="text-muted-foreground">
					Order #{order.id.slice(0, 8)} • {formatDate(order.createdAt)}
				</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Order Summary */}
				<div className="lg:col-span-1">
					<Card className="sticky top-8">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<ShoppingCart className="h-5 w-5" />
								Order Summary
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-3">
								{order.items.map((item) => {
									const productData = item.productData as any
									return (
										<div key={item.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
											{productData?.image && (
												<div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md">
													<Image
														src={productData.image}
														alt={productData?.name || 'Product'}
														fill
														className="object-cover"
														unoptimized
													/>
												</div>
											)}
											<div className="flex-1 min-w-0">
												<p className="font-medium text-sm truncate">
													{productData?.name || 'Unknown Product'}
												</p>
												<p className="text-xs text-muted-foreground">Quantity: {item.quantity}</p>
											</div>
											<span className="font-semibold text-sm shrink-0">
												{formatCurrency(item.price * item.quantity)}
											</span>
										</div>
									)
								})}
							</div>
							<div className="border-t pt-4 space-y-2">
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Subtotal</span>
									<span>{formatCurrency(order.totalAmount)}</span>
								</div>
								<div className="flex justify-between text-lg font-bold border-t pt-2">
									<span>Total</span>
									<span className="text-primary">{formatCurrency(order.totalAmount)}</span>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Payment Section */}
				<div className="lg:col-span-2">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<CreditCard className="h-5 w-5" />
										PromptPay Payment
									</CardTitle>
									<CardDescription className="mt-1">
										Scan the QR code with your banking app to complete payment
									</CardDescription>
								</div>
								{chargeStatus && (
									<Badge 
										variant={
											chargeStatus === 'pending' 
												? 'default' 
												: chargeStatus === 'successful' || chargeStatus === 'paid'
												? 'default'
												: 'destructive'
										}
										className="shrink-0"
									>
										{chargeStatus === 'pending' && 'Pending'}
										{(chargeStatus === 'successful' || chargeStatus === 'paid') && 'Successful'}
										{chargeStatus === 'failed' && 'Failed'}
										{chargeStatus === 'expired' && 'Expired'}
									</Badge>
								)}
							</div>
						</CardHeader>
						<CardContent className="space-y-6">

							{errorMessage && (
								<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
									<div className="flex items-start space-x-3">
										<AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
										<div className="flex-1">
											<p className="text-sm font-medium text-destructive">Payment Error</p>
											<p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
										</div>
									</div>
								</div>
							)}

							{/* Amount limits info - Omise PromptPay: min THB 20, max THB 150,000 */}
							{(order.totalAmount < 20 || order.totalAmount > 150000) && (
								<div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
									<div className="flex items-start space-x-3">
										<AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
										<p className="text-sm text-yellow-800">
											PromptPay supports amounts between THB 20.00 and THB 150,000.00
										</p>
									</div>
								</div>
							)}

							{isLoading ? (
								<div className="flex flex-col items-center justify-center py-16 space-y-4">
									<div className="relative">
										<div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
										<Loader2 className="relative h-12 w-12 animate-spin text-primary" />
									</div>
									<div className="text-center space-y-1">
										<p className="font-medium">Creating payment request...</p>
										<p className="text-sm text-muted-foreground">Please wait a moment</p>
									</div>
								</div>
							) : qrCodeUrl ? (
								<div className="space-y-6">
									{/* QR Code Display */}
									<div className="flex flex-col items-center space-y-4">
										<div className="relative">
											<div className="absolute -inset-4 rounded-2xl bg-primary/10 blur-xl" />
											<div className="relative h-80 w-80 rounded-2xl border-4 border-primary/20 bg-white p-6 shadow-2xl">
												<Image
													src={qrCodeUrl}
													alt="PromptPay QR Code"
													fill
													className="object-contain rounded-lg"
													unoptimized
												/>
											</div>
										</div>

										<div className="text-center space-y-2">
											<div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
												<QrCode className="h-4 w-4 text-primary" />
												<span className="text-sm font-medium">Scan with your banking app</span>
											</div>
										</div>

										{/* QR Code Expiration */}
										{qrExpiresAt && (
											<div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/50 px-4 py-3">
												<Clock className="h-4 w-4 text-muted-foreground" />
												<span className="text-sm text-muted-foreground">
													Expires in:{' '}
													<span className="font-semibold text-foreground">
														{(() => {
															const hoursRemaining = Math.max(0, Math.floor((qrExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60)))
															const minutesRemaining = Math.max(0, Math.floor(((qrExpiresAt.getTime() - Date.now()) % (1000 * 60 * 60)) / (1000 * 60)))
															if (hoursRemaining > 0) {
																return `${hoursRemaining}h ${minutesRemaining}m`
															}
															return `${minutesRemaining}m`
														})()}
													</span>
												</span>
											</div>
										)}
									</div>

									{/* Payment Status */}
									{isPolling && (
										<div className="rounded-lg border bg-primary/5 p-6">
											<div className="flex flex-col items-center space-y-3 text-center">
												<div className="flex items-center gap-3">
													<Loader2 className="h-5 w-5 animate-spin text-primary" />
													<span className="font-medium">Waiting for payment confirmation...</span>
												</div>
												<p className="text-sm text-muted-foreground max-w-md">
													The system is automatically checking payment status every 10 seconds. Please keep this page open.
												</p>
											</div>
										</div>
									)}

									{/* Security Notice */}
									<div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
										<Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
										<div className="flex-1 space-y-1">
											<p className="text-sm font-medium">Secure Payment</p>
											<p className="text-xs text-muted-foreground">
												Your payment is processed securely through Omise. No card information is stored on our servers.
											</p>
										</div>
									</div>
								</div>
							) : (
								<div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
									<div className="rounded-full bg-destructive/10 p-4">
										<XCircle className="h-12 w-12 text-destructive" />
									</div>
									<div className="space-y-2">
										<p className="font-medium">Failed to load QR code</p>
										<p className="text-sm text-muted-foreground">
											Please try again or contact support if the issue persists
										</p>
									</div>
									<Button
										onClick={() => {
											isInitializingRef.current = false
											setErrorMessage(null)
											initializePayment()
										}}
										variant="outline"
										className="mt-4"
									>
										<Loader2 className="mr-2 h-4 w-4" />
										Retry
									</Button>
								</div>
							)}

							{order.status === 'cancelled' && (
								<div className="border-t pt-6 space-y-4">
									<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
										<div className="flex items-start space-x-3">
											<XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
											<div className="flex-1">
												<p className="text-sm font-medium text-destructive">Order Cancelled</p>
												<p className="text-sm text-muted-foreground mt-1">
													This order has been cancelled. You cannot proceed with payment.
												</p>
											</div>
										</div>
									</div>
									<Button
										onClick={() => router.push(`/orders/${order.id}`)}
										className="w-full"
										variant="outline"
									>
										View Order Details
									</Button>
								</div>
							)}

							{order.status === 'pending' && (
								<div className="border-t pt-6 space-y-3">
									{/* Show retry button if QR code failed to load or expired */}
									{(!qrCodeUrl || chargeStatus === 'expired' || chargeStatus === 'failed') && (
										<Button
											onClick={() => {
												isInitializingRef.current = false
												setErrorMessage(null)
												setChargeStatus(null)
												initializePayment()
											}}
											disabled={isLoading}
											className="w-full"
											variant="outline"
											size="lg"
										>
											{isLoading ? (
												<>
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													Creating Payment...
												</>
											) : (
												<>
													<QrCode className="mr-2 h-4 w-4" />
													Create New Payment Request
												</>
											)}
										</Button>
									)}
									<Button
										variant="destructive"
										onClick={handleCancel}
										disabled={isCancelling || isLoading}
										className="w-full"
										size="lg"
									>
										<X className="mr-2 h-4 w-4" />
										{isCancelling ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Cancelling...
											</>
										) : (
											'Cancel Order'
										)}
									</Button>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}

