import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/navbar'
import { StructuredData } from '@/components/seo/structured-data'
import { FAQSection } from '@/components/seo/faq-section'
import { Breadcrumbs } from '@/components/seo/breadcrumbs'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, Download, Check, Shield, Zap } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BuyButton } from '@/components/buy-button'

const siteUrl = process.env.NEXTAUTH_URL || 'https://s1dev-shop.com'

interface ProductPageProps {
	params: { id: string }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
	const product = await prisma.product.findUnique({
		where: { id: params.id },
	})

	if (!product || !product.isActive) {
		return {
			title: 'Product Not Found',
		}
	}

	const productUrl = `${siteUrl}/products/${product.id}`
	const productImage = product.image || `${siteUrl}/placeholder-product.jpg`
	const productDescription =
		product.description ||
		`Buy ${product.name} at S1Dev Shop. ${product.type === 'script' ? 'Roblox script' : product.type === 'key' ? 'Game key' : 'Digital product'} with instant delivery.`

	return {
		title: `${product.name} - S1Dev Shop`,
		description: productDescription,
		keywords: [
			product.name.toLowerCase(),
			product.type === 'script' ? 'roblox script' : product.type === 'key' ? 'roblox key' : 'digital item',
			product.category?.toLowerCase() || '',
			'buy online',
			'instant delivery',
		].filter(Boolean),
		openGraph: {
			title: product.name,
			description: productDescription,
			url: productUrl,
			type: 'website',
			images: [
				{
					url: productImage,
					width: 1200,
					height: 630,
					alt: product.name,
				},
			],
		},
		twitter: {
			card: 'summary_large_image',
			title: product.name,
			description: productDescription,
			images: [productImage],
		},
		alternates: {
			canonical: productUrl,
		},
	}
}

export default async function ProductPage({ params }: ProductPageProps) {
	const session = await getServerSession(authOptions)

	const product = await prisma.product.findUnique({
		where: { id: params.id },
	})

	if (!product || !product.isActive) {
		notFound()
	}

	// ตาม Rules: Product Schema with required fields
	const productSchema = {
		'@context': 'https://schema.org',
		'@type': 'Product',
		name: product.name,
		description: product.description || product.name,
		image: product.image || `${siteUrl}/placeholder-product.jpg`,
		sku: product.id,
		brand: {
			'@type': 'Brand',
			name: 'S1Dev',
		},
		offers: {
			'@type': 'Offer',
			url: `${siteUrl}/products/${product.id}`,
			priceCurrency: 'THB',
			price: product.price,
			availability:
				product.stock > 0 || product.type === 'key' || product.type === 'script'
					? 'https://schema.org/InStock'
					: 'https://schema.org/OutOfStock',
			priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
		},
		applicationCategory:
			product.type === 'script'
				? 'GameUtility'
				: product.type === 'key'
					? 'Game'
					: 'SoftwareApplication',
		operatingSystem: 'Windows',
		...(product.type === 'script' && {
			additionalProperty: {
				'@type': 'PropertyValue',
				name: 'File Format',
				value: '.lua',
			},
		}),
	}

	// ตาม Rules AEO: FAQ questions (5-7 questions)
	const faqs = [
		{
			question: `What is ${product.name}?`,
			answer:
				product.description ||
				`${product.name} is a ${product.type === 'script' ? 'Roblox automation script' : product.type === 'key' ? 'digital game key' : 'digital product'} available on S1Dev Shop. ${product.type === 'key' ? 'This product includes a digital key that will be delivered instantly after purchase.' : product.type === 'script' ? 'This product includes source code/script that you can use with supported executors.' : 'This product will be delivered digitally after purchase.'}`,
		},
		{
			question: 'How do I receive my purchase?',
			answer:
				product.type === 'key'
					? 'After payment is confirmed, your digital key will be delivered instantly via email and will also be available in your order history. Keys may have expiration dates depending on the product.'
					: product.type === 'script'
						? 'After payment is confirmed, you will receive access to download the source code/script. Free scripts can be accessed directly from the product page.'
						: 'After payment is confirmed, you will receive your digital product via email and in your order history.',
		},
		{
			question: 'Is it safe to use?',
			answer:
				'Yes! We use Omise, a trusted payment gateway, to process all transactions securely. All our products are verified and safe to use. For scripts, make sure to use them responsibly and follow Roblox community guidelines.',
		},
		{
			question: 'What payment methods do you accept?',
			answer: 'We accept PromptPay payments through Omise. You can scan the QR code provided during checkout to complete your payment securely.',
		},
		{
			question:
				product.type === 'key' && product.expireDays
					? 'How long is this key valid?'
					: 'Can I get a refund?',
			answer:
				product.type === 'key' && product.expireDays
					? `This key expires in ${product.expireDays === 'Never' ? 'never (no expiration)' : product.expireDays}. Please use it before the expiration date.`
					: 'Due to the digital nature of our products, refunds are generally not available. However, if you encounter any issues with your purchase, please contact our support team for assistance.',
		},
		{
			question:
				product.type === 'script'
					? 'What executors are compatible with this script?'
					: 'How long does delivery take?',
			answer:
				product.type === 'script'
					? 'This script is compatible with most popular Roblox executors including Synapse X, Fluxus, Delta, and other standard Lua executors. Make sure your executor supports the script format (.lua).'
					: 'Most products are delivered instantly after payment confirmation. Some products may take a few minutes to process, but you will receive notification once your order is ready.',
		},
	]

	const isAvailable = product.type === 'key' || product.type === 'script' || product.stock > 0

	// แยก description ออกเป็น features และ benefits (ตาม Rules)
	const descriptionLines = product.description?.split('\n') || []
	const features: string[] = []
	const benefits: string[] = []

	descriptionLines.forEach((line) => {
		if (line.toLowerCase().includes('feature') || line.toLowerCase().includes('includes')) {
			features.push(line)
		} else if (
			line.toLowerCase().includes('benefit') ||
			line.toLowerCase().includes('saves') ||
			line.toLowerCase().includes('improves')
		) {
			benefits.push(line)
		}
	})

	// ตาม Rules: Product Description Structure (12 steps)
	return (
		<div className="min-h-screen bg-background">
			<StructuredData data={productSchema} />
			<Navbar />
			<div className="container mx-auto px-4 py-8">
				<Breadcrumbs
					items={[
						{ label: 'Products', href: '/products' },
						{ label: product.name },
					]}
					siteUrl={siteUrl}
				/>

				{/* 1. H1: Product Name */}
				<div className="mb-8 grid gap-8 lg:grid-cols-2">
					{/* Product Image */}
					<div className="space-y-4">
						{product.image ? (
							<div className="relative aspect-square w-full overflow-hidden rounded-lg border">
								<Image
									src={product.image}
									alt={product.name}
									fill
									className="object-cover"
									priority
									unoptimized
								/>
							</div>
						) : (
							<div className="aspect-square w-full rounded-lg border bg-muted flex items-center justify-center">
								<span className="text-muted-foreground">No Image</span>
							</div>
						)}
					</div>

					{/* Product Info */}
					<div className="space-y-6">
						<div>
							{product.category && (
								<Badge variant="secondary" className="mb-2">
									{product.category}
								</Badge>
							)}
							<h1 className="text-4xl font-bold">{product.name}</h1>
							<div className="mt-4 text-3xl font-bold text-primary">
								{formatCurrency(product.price)}
							</div>
						</div>

						{/* 2. Short summary (2-4 sentences) - AEO Answer */}
						<div className="rounded-lg border bg-muted/50 p-4">
							<p className="text-sm font-medium text-muted-foreground">What is this?</p>
							<p className="mt-1 text-base leading-relaxed">
								{product.name} is a {product.type === 'script' ? 'Roblox automation script' : product.type === 'key' ? 'digital game key' : 'digital product'}{' '}
								{product.type === 'script' ? 'that enhances your gaming experience with automation features' : product.type === 'key' ? 'that unlocks premium game content' : 'available for instant delivery'}.{' '}
								{product.type === 'script' ? 'It' : 'This product'} is{' '}
								{product.type === 'script' ? 'best suited for players looking to automate repetitive tasks and improve their gameplay efficiency' : 'perfect for gamers who want instant access to premium content'}.{' '}
								All products come with secure payment and instant delivery.
							</p>
						</div>

						{/* Product Details */}
						<div className="space-y-2 text-sm">
							{product.type !== 'key' && product.type !== 'script' && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Stock:</span>
									<span className="font-semibold">{product.stock}</span>
								</div>
							)}
							{product.type === 'key' && product.expireDays && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Expires:</span>
									<span className="font-semibold">
										{product.expireDays === 'Never' ? 'Never' : product.expireDays}
									</span>
								</div>
							)}
							{product.type && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Type:</span>
									<span className="font-semibold capitalize">{product.type}</span>
								</div>
							)}
						</div>

						{/* Purchase Buttons */}
						<div className="space-y-4 pt-4">
							<BuyButton
								productId={product.id}
								price={product.price}
								type={product.type}
								isAvailable={isAvailable}
								size="lg"
								className="w-full"
								isFree={product.price === 0 && product.type === 'script'}
							/>
							<Button asChild variant="outline" className="w-full" size="lg">
								<Link href="/products">Continue Shopping</Link>
							</Button>
						</div>
					</div>
				</div>

				{/* Product Details Section */}
				<div className="mt-12 grid gap-8 lg:grid-cols-3">
					<div className="lg:col-span-2 space-y-8">
						{/* 3. Key Features (bullets) */}
						{product.description && (
							<section>
								<h2 className="mb-4 text-2xl font-bold">Key Features</h2>
								<div className="space-y-3">
									{features.length > 0 ? (
										<ul className="space-y-2">
											{features.map((feature, index) => (
												<li key={index} className="flex items-start gap-2">
													<Check className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
													<span>{feature.replace(/^[-*]\s*/, '')}</span>
												</li>
											))}
										</ul>
									) : (
										<div className="rounded-lg border bg-card p-4">
											<p className="whitespace-pre-line text-muted-foreground">
												{product.description}
											</p>
										</div>
									)}
								</div>
							</section>
						)}

						{/* 4. Main Benefits (bullets) */}
						{benefits.length > 0 && (
							<section>
								<h2 className="mb-4 text-2xl font-bold">Benefits</h2>
								<ul className="space-y-2">
									{benefits.map((benefit, index) => (
										<li key={index} className="flex items-start gap-2">
											<Zap className="mt-1 h-5 w-5 flex-shrink-0 text-yellow-500" />
											<span>{benefit.replace(/^[-*]\s*/, '')}</span>
										</li>
									))}
								</ul>
							</section>
						)}

						{/* 5. Supported Games / Compatibility */}
						{product.category && (
							<section>
								<h2 className="mb-4 text-2xl font-bold">Compatibility</h2>
								<div className="space-y-3">
									<div className="rounded-lg border bg-card p-4">
										<p className="text-sm text-muted-foreground">
											Category: <span className="font-semibold text-foreground">{product.category}</span>
										</p>
										{product.type === 'script' && (
											<p className="mt-2 text-sm text-muted-foreground">
												Compatible with popular Roblox executors including Synapse X, Fluxus, Delta, and other standard Lua executors.
											</p>
										)}
										{product.type === 'key' && (
											<p className="mt-2 text-sm text-muted-foreground">
												Compatible with all standard Roblox game platforms.
											</p>
										)}
									</div>
								</div>
							</section>
						)}

						{/* 6. How It Works (step-by-step) */}
						<section>
							<h2 className="mb-4 text-2xl font-bold">How It Works</h2>
							<ol className="space-y-3">
								<li className="flex gap-3">
									<span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
										1
									</span>
									<span className="flex-1">
										<strong>Purchase:</strong> Add to cart and complete secure payment via PromptPay
									</span>
								</li>
								<li className="flex gap-3">
									<span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
										2
									</span>
									<span className="flex-1">
										<strong>Receive:</strong> Get instant delivery via email and in your order history
									</span>
								</li>
								<li className="flex gap-3">
									<span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
										3
									</span>
									<span className="flex-1">
										<strong>Use:</strong>{' '}
										{product.type === 'script'
											? 'Copy the script and use it with your preferred executor'
											: product.type === 'key'
												? 'Redeem your key in the game or platform'
												: 'Access your digital product immediately'}
									</span>
								</li>
							</ol>
						</section>

						{/* 7. What's Included */}
						<section>
							<h2 className="mb-4 text-2xl font-bold">What&apos;s Included</h2>
							<div className="rounded-lg border bg-card p-4">
								<ul className="space-y-2">
									<li className="flex items-center gap-2">
										<Check className="h-5 w-5 text-primary" />
										<span>
											{product.type === 'script' ? 'Source code file (.lua)' : product.type === 'key' ? 'Digital key/code' : 'Digital product'}
										</span>
									</li>
									<li className="flex items-center gap-2">
										<Check className="h-5 w-5 text-primary" />
										<span>Instant delivery after payment</span>
									</li>
									<li className="flex items-center gap-2">
										<Check className="h-5 w-5 text-primary" />
										<span>Email confirmation and order tracking</span>
									</li>
									{product.type === 'key' && product.expireDays && product.expireDays !== 'Never' && (
										<li className="flex items-center gap-2">
											<Check className="h-5 w-5 text-primary" />
											<span>Valid for {product.expireDays}</span>
										</li>
									)}
								</ul>
							</div>
						</section>

						{/* 8. Safety & Usage Notice */}
						<section>
							<h2 className="mb-4 text-2xl font-bold">Safety & Usage Notice</h2>
							<div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
								<Shield className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
								<div className="text-sm">
									<p className="font-semibold text-blue-900 dark:text-blue-100">
										Safe & Secure
									</p>
									<p className="mt-1 text-blue-700 dark:text-blue-300">
										All purchases are processed securely through Omise payment gateway. We never store your payment information. Use responsibly and follow Roblox community guidelines.
									</p>
								</div>
							</div>
						</section>
					</div>

					{/* Sidebar */}
					<div className="lg:col-span-1">
						<div className="sticky top-8 space-y-4 rounded-lg border bg-card p-6">
							<h3 className="font-semibold">Quick Info</h3>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Price:</span>
									<span className="font-semibold">{formatCurrency(product.price)}</span>
								</div>
								{product.type && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Type:</span>
										<span className="font-semibold capitalize">{product.type}</span>
									</div>
								)}
								{product.category && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Category:</span>
										<span className="font-semibold">{product.category}</span>
									</div>
								)}
								<div className="flex justify-between">
									<span className="text-muted-foreground">Delivery:</span>
									<span className="font-semibold">Instant</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* 11. FAQs (5-7 questions) */}
				<div className="mt-16">
					<FAQSection faqs={faqs} />
				</div>

				{/* 12. Related Products - ไว้สำหรับเพิ่มในอนาคต */}
			</div>
		</div>
	)
}

