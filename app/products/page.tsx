import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/navbar'
import { ProductGrid } from '@/components/product-grid'

export default async function ProductsPage() {
	const session = await getServerSession(authOptions)

	if (!session) {
		redirect('/login')
	}

	const products = await prisma.product.findMany({
		where: { isActive: true },
		orderBy: { createdAt: 'desc' },
	})

	return (
		<div className="min-h-screen bg-background">
			<Navbar />
			<div className="container mx-auto px-4 py-8">
				<h1 className="mb-8 text-3xl font-bold">Products</h1>
				<ProductGrid products={products} />
			</div>
		</div>
	)
}

