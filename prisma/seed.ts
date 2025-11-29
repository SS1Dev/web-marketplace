import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
	// Create admin user
	const adminPassword = await bcrypt.hash('admin123', 10)
	
	// Check if admin exists
	const existingAdmin = await prisma.user.findUnique({
		where: { email: 'admin@example.com' },
	})
	
	if (!existingAdmin) {
		await prisma.user.create({
			data: {
				email: 'admin@example.com',
				password: adminPassword,
				name: 'Admin User',
				role: 'admin',
			},
		})
		console.log('Admin user created: admin@example.com / admin123')
	} else {
		console.log('Admin user already exists')
	}

	// Create test user
	const userPassword = await bcrypt.hash('user123', 10)
	
	const existingUser = await prisma.user.findUnique({
		where: { email: 'user@example.com' },
	})
	
	if (!existingUser) {
		await prisma.user.create({
			data: {
				email: 'user@example.com',
				password: userPassword,
				name: 'Test User',
				role: 'user',
			},
		})
		console.log('Test user created: user@example.com / user123')
	} else {
		console.log('Test user already exists')
	}

	// Create sample products
	const products = [
		{
			name: 'Steam Wallet Code 100 THB',
			description: 'Steam Wallet code worth 100 THB',
			price: 100,
			stock: 50,
			category: 'Gaming',
		},
		{
			name: 'Steam Wallet Code 500 THB',
			description: 'Steam Wallet code worth 500 THB',
			price: 500,
			stock: 30,
			category: 'Gaming',
		},
		{
			name: 'PlayStation Plus 1 Month',
			description: 'PlayStation Plus subscription code for 1 month',
			price: 199,
			stock: 20,
			category: 'Gaming',
		},
		{
			name: 'Xbox Game Pass 1 Month',
			description: 'Xbox Game Pass subscription code for 1 month',
			price: 249,
			stock: 25,
			category: 'Gaming',
		},
		{
			name: 'Nintendo eShop Card 500 THB',
			description: 'Nintendo eShop card worth 500 THB',
			price: 500,
			stock: 15,
			category: 'Gaming',
		},
	]

	let createdCount = 0
	for (const product of products) {
		const existing = await prisma.product.findUnique({
			where: { name: product.name },
		})
		
		if (!existing) {
			await prisma.product.create({
				data: product,
			})
			createdCount++
		}
	}

	console.log(`Created ${createdCount} new products (${products.length} total)`)
	console.log('\nSeed data summary:')
	console.log('- Admin user: admin@example.com / admin123')
	console.log('- Test user: user@example.com / user123')
	console.log(`- ${products.length} sample products`)
}

main()
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})

