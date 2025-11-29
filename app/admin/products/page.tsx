import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/navbar'
import { ProductManagement } from '@/components/product-management'

export default async function AdminProductsPage() {
	const session = await getServerSession(authOptions)

	if (!session || session.user.role !== 'admin') {
		redirect('/products')
	}

	const products = await prisma.product.findMany({
		orderBy: { createdAt: 'desc' },
	})

	return (
		<div className="min-h-screen bg-background">
			<Navbar />
			<div className="container mx-auto px-4 py-8">
				<ProductManagement products={products} />
			</div>
		</div>
	)
}

