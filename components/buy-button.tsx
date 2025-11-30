'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Download } from 'lucide-react'
import { ReactNode } from 'react'

interface BuyButtonProps {
	productId: string
	price: number
	type: string
	isAvailable: boolean
	children?: ReactNode
	variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'link'
	size?: 'default' | 'sm' | 'lg' | 'icon'
	className?: string
	isFree?: boolean
}

export function BuyButton({
	productId,
	price,
	type,
	isAvailable,
	children,
	variant = 'default',
	size = 'default',
	className,
	isFree = false,
}: BuyButtonProps) {
	const router = useRouter()
	const { data: session } = useSession()

	const handleBuy = (e: React.MouseEvent) => {
		e.preventDefault()
		
		if (!session) {
			// Redirect to login with callback URL
			router.push(`/login?callbackUrl=${encodeURIComponent(`/products/${productId}/checkout`)}`)
			return
		}

		// User is logged in, proceed to checkout
		router.push(`/products/${productId}/checkout`)
	}

	return (
		<Button
			onClick={handleBuy}
			variant={variant}
			size={size}
			className={className}
			disabled={!isAvailable}
		>
			{children || (
				<>
					{isFree ? (
						<>
							<Download className="mr-2 h-5 w-5" />
							Get Free
						</>
					) : (
						<>
							<ShoppingCart className="mr-2 h-5 w-5" />
							{isAvailable ? 'Buy Now' : 'Out of Stock'}
						</>
					)}
				</>
			)}
		</Button>
	)
}

