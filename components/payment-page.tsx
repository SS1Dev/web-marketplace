'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Loader2, CheckCircle2, XCircle, X } from 'lucide-react'
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
		
		// Use longer polling interval when webhook is enabled (acts as fallback)
		// Webhook will handle real-time updates, polling is just a backup
		const pollingInterval = 10000 // Poll every 10 seconds (webhook handles real-time)
		
		pollingIntervalRef.current = setInterval(async () => {
			try {
				const response = await fetch(`/api/payments/status?orderId=${order.id}&refresh=true`)
				const data = await response.json()

				if (data.status === 'paid' || data.status === 'completed') {
					if (pollingIntervalRef.current) {
						clearInterval(pollingIntervalRef.current)
					}
					setIsPolling(false)
					toast({
						title: 'Payment Successful',
						description: 'Your payment has been confirmed',
						variant: 'success',
					})
					router.push(`/orders/${order.id}`)
					router.refresh()
				}
			} catch (error) {
				console.error('Error checking payment status:', error)
			}
		}, pollingInterval)

		// Stop polling after 10 minutes
		pollingTimeoutRef.current = setTimeout(() => {
			if (pollingIntervalRef.current) {
				clearInterval(pollingIntervalRef.current)
			}
			setIsPolling(false)
		}, 600000)
	}, [order.id, router, toast])

	const initializePayment = useCallback(async () => {
		// Prevent duplicate calls
		if (isInitializingRef.current) {
			console.log('Payment initialization already in progress, skipping...')
			return
		}

		// Check if already has charge ID (prevent duplicate)
		if (order.omiseChargeId) {
			console.log('Payment already initialized, skipping...')
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
						variant: 'default',
					})
					// Redirect to order detail page after a short delay
					setTimeout(() => {
						router.push(`/orders/${order.id}`)
					}, 1500)
					return
				}
				throw new Error(data.error || 'Failed to initialize payment')
			}

			setQrCodeUrl(data.qrCodeUrl)
			setIsLoading(false)
			startPolling()
		} catch (error) {
			toast({
				title: 'Error',
				description: error instanceof Error ? error.message : 'Failed to initialize payment',
				variant: 'destructive',
			})
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
		if (order.omiseChargeId && order.qrCodeUrl) {
			// Payment already initialized
			setQrCodeUrl(order.qrCodeUrl)
			setIsLoading(false)
			if (order.status === 'pending') {
				startPolling()
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
		<div className="mx-auto max-w-4xl">
			<Card>
				<CardHeader>
					<CardTitle>Payment</CardTitle>
					<CardDescription>
						Order #{order.id.slice(0, 8)} - {formatDate(order.createdAt)}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="space-y-2">
						<h3 className="text-lg font-semibold">Order Summary</h3>
						<div className="space-y-3">
							{order.items.map((item) => {
								const productData = item.productData as any
								return (
									<div key={item.id} className="flex items-center gap-3">
										{productData?.image && (
											<div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded">
												<Image
													src={productData.image}
													alt={productData?.name || 'Product'}
													fill
													className="object-cover"
													unoptimized
												/>
											</div>
										)}
										<div className="flex-1">
											<span className="font-medium">
												{productData?.name || 'Unknown Product'} x {item.quantity}
											</span>
										</div>
										<span className="font-semibold">{formatCurrency(item.price * item.quantity)}</span>
									</div>
								)
							})}
						</div>
						<div className="flex justify-between border-t pt-2 text-lg font-bold">
							<span>Total:</span>
							<span className="text-primary">{formatCurrency(order.totalAmount)}</span>
						</div>
					</div>

					<div className="space-y-4">
						<h3 className="text-lg font-semibold">Scan QR Code to Pay</h3>
						{isLoading ? (
							<div className="flex items-center justify-center py-12">
								<Loader2 className="h-8 w-8 animate-spin text-primary" />
							</div>
						) : qrCodeUrl ? (
							<div className="flex flex-col items-center space-y-4">
								<div className="relative h-64 w-64 rounded-lg border bg-white p-4">
									<Image
										src={qrCodeUrl}
										alt="Promptpay QR Code"
										fill
										className="object-contain"
										unoptimized
									/>
								</div>
								<p className="text-sm text-muted-foreground text-center">
									Scan this QR code with your banking app to complete the payment
								</p>
								{isPolling && (
									<div className="flex flex-col items-center space-y-2 text-sm text-muted-foreground">
										<div className="flex items-center space-x-2">
											<Loader2 className="h-4 w-4 animate-spin" />
											<span>Waiting for payment confirmation...</span>
										</div>
										<p className="text-xs text-muted-foreground/70">
											The system will automatically detect your payment via webhook
										</p>
									</div>
								)}
							</div>
						) : (
							<div className="text-center py-12">
								<XCircle className="mx-auto h-12 w-12 text-destructive" />
								<p className="mt-4 text-muted-foreground">
									Failed to load QR code. Please try again.
								</p>
								<Button
									onClick={() => {
										isInitializingRef.current = false
										initializePayment()
									}}
									className="mt-4"
								>
									Retry
								</Button>
							</div>
						)}
					</div>

					{order.status === 'pending' && (
						<div className="border-t pt-4">
							<Button
								variant="destructive"
								onClick={handleCancel}
								disabled={isCancelling || isLoading}
								className="w-full"
							>
								<X className="mr-2 h-4 w-4" />
								{isCancelling ? 'Cancelling...' : 'Cancel Order'}
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

