import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminLayout } from '@/components/admin-layout'
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
		<AdminLayout>
			<ProductManagement products={products} />
		</AdminLayout>
	)
}

