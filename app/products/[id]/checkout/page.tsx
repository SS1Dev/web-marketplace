import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/navbar'
import { CheckoutForm } from '@/components/checkout-form'

export default async function CheckoutPage({
	params,
}: {
	params: { id: string }
}) {
	const session = await getServerSession(authOptions)

	if (!session) {
		redirect('/login')
	}

	const product = await prisma.product.findUnique({
		where: { id: params.id },
	})

	if (!product || !product.isActive) {
		redirect('/products')
	}

	// Check stock only for non-key and non-script products
	if (product.type !== 'key' && product.type !== 'script' && product.stock === 0) {
		redirect('/products')
	}

	// Redirect script products with price 0 back to products (they should use Get Free button)
	if (product.type === 'script' && product.price === 0) {
		redirect('/products')
	}

	return (
		<div className="min-h-screen bg-background">
			<Navbar />
			<div className="container mx-auto px-4 py-8">
				<CheckoutForm product={product} userId={session.user.id} />
			</div>
		</div>
	)
}

