import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StructuredData } from '@/components/seo/structured-data'
import { FAQSection } from '@/components/seo/faq-section'
import { Navbar } from '@/components/navbar'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
	Package, 
	Zap, 
	Shield, 
	CreditCard, 
	Download, 
	Gamepad2,
	Code,
	Key,
	ArrowRight,
	Check
} from 'lucide-react'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'

const siteUrl = process.env.NEXTAUTH_URL || 'https://s1dev-shop.com'

export const metadata: Metadata = {
	title: 'S1Dev Shop - Buy Roblox Scripts, Game Keys & Executor Keys',
	description:
		'Your trusted marketplace for Roblox scripts, game keys, executor keys, and digital items. Fast delivery, secure payment with PromptPay, and instant access to your purchases.',
	openGraph: {
		title: 'S1Dev Shop - Buy Roblox Scripts, Game Keys & Executor Keys',
		description:
			'Your trusted marketplace for Roblox scripts, game keys, executor keys, and digital items. Fast delivery, secure payment with PromptPay, and instant access to your purchases.',
		url: siteUrl,
		type: 'website',
	},
	twitter: {
		card: 'summary_large_image',
		title: 'S1Dev Shop - Buy Roblox Scripts, Game Keys & Executor Keys',
		description:
			'Your trusted marketplace for Roblox scripts, game keys, executor keys, and digital items.',
	},
	alternates: {
		canonical: siteUrl,
	},
}

export default async function HomePage() {
	const session = await getServerSession(authOptions)

	// Get product counts for stats
	const [totalProducts, scriptCount, keyCount] = await Promise.all([
		prisma.product.count({ where: { isActive: true } }),
		prisma.product.count({ where: { isActive: true, type: 'script' } }),
		prisma.product.count({ where: { isActive: true, type: 'key' } }),
	])

	// ตาม Rules AEO: Direct answer at page start (2-4 sentences)
	const aeoAnswer = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: [
			{
				'@type': 'Question',
				name: 'What is S1Dev Shop?',
				acceptedAnswer: {
					'@type': 'Answer',
					text: 'S1Dev Shop is your trusted marketplace for Roblox scripts, game keys, executor keys, and digital items. We provide instant delivery and secure payment options for gamers looking to enhance their gaming experience with automation scripts and premium game content.',
				},
			},
		],
	}

	// FAQ สำหรับ AEO
	const faqs = [
		{
			question: 'What products do you sell?',
			answer:
				'We sell Roblox scripts, game keys, executor keys, gamepass codes, and various digital items. All products are delivered instantly after payment confirmation. Our collection includes automation scripts for Roblox games, premium game keys, and gamepass codes.',
		},
		{
			question: 'How does instant delivery work?',
			answer:
				'Once your payment is confirmed through our secure PromptPay payment system, you will receive your digital product immediately via email and can also access it in your order history. Most products are delivered within seconds of payment confirmation.',
		},
		{
			question: 'Is it safe to purchase from S1Dev Shop?',
			answer:
				'Yes! We use Omise, a trusted payment gateway, to process all transactions securely. We never store your payment information, and all purchases are protected. All products are verified and safe to use. Use responsibly and follow Roblox community guidelines.',
		},
		{
			question: 'What payment methods do you accept?',
			answer:
				'We accept PromptPay payments through Omise. Simply scan the QR code during checkout to complete your purchase securely. The payment process is fast, secure, and encrypted.',
		},
		{
			question: 'Are your scripts compatible with all executors?',
			answer:
				'Our Roblox scripts are compatible with popular executors including Synapse X, Fluxus, Delta, and other standard Lua executors. Each product page lists specific compatibility information to help you choose the right script for your executor.',
		},
		{
			question: 'Can I get a refund?',
			answer:
				'Due to the digital nature of our products, refunds are generally not available. However, if you experience any issues with your purchase, please contact our support team for assistance. We are committed to ensuring customer satisfaction.',
		},
		{
			question: 'How long does it take to receive my product?',
			answer:
				'Most products are delivered instantly after payment confirmation. Some products may take a few minutes to process, but you will receive notification via email once your order is ready. All digital items are available immediately in your order history.',
		},
	]

	return (
		<div className="min-h-screen bg-background">
			<StructuredData data={aeoAnswer} />
			<Navbar />
			
			{/* Hero Section - ตาม Rules AEO: Direct answer */}
			<section className="border-b border-border bg-gradient-to-b from-background to-card/50 py-20">
				<div className="container mx-auto px-4">
					<div className="mx-auto max-w-4xl text-center">
						<Badge className="mb-4" variant="secondary">
							Trusted Marketplace
						</Badge>
						<h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl">
							Roblox Scripts, Game Keys &{' '}
							<span className="text-primary">Executor Keys</span>
						</h1>
						<p className="mb-8 text-xl leading-relaxed text-muted-foreground">
							S1Dev Shop is your trusted marketplace for Roblox scripts, game keys, executor keys, and digital items. 
							We provide instant delivery and secure payment options for gamers looking to enhance their gaming experience 
							with automation scripts and premium game content.
						</p>
						<div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
							{session ? (
								<Button asChild size="lg" className="text-lg">
									<Link href="/products">
										<Package className="mr-2 h-5 w-5" />
										Browse Products
									</Link>
								</Button>
							) : (
								<Button asChild size="lg" className="text-lg">
									<Link href="/register">
										Get Started
										<ArrowRight className="ml-2 h-5 w-5" />
									</Link>
								</Button>
							)}
							<Button asChild variant="outline" size="lg" className="text-lg">
								<Link href="/products">
									<Gamepad2 className="mr-2 h-5 w-5" />
									View All Products
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Stats Section */}
			<section className="border-b border-border bg-card py-12">
				<div className="container mx-auto px-4">
					<div className="grid grid-cols-1 gap-8 md:grid-cols-3">
						<div className="text-center">
							<div className="mb-2 text-4xl font-bold text-primary">{totalProducts}+</div>
							<div className="text-muted-foreground">Products Available</div>
						</div>
						<div className="text-center">
							<div className="mb-2 text-4xl font-bold text-primary">{scriptCount}+</div>
							<div className="text-muted-foreground">Roblox Scripts</div>
						</div>
						<div className="text-center">
							<div className="mb-2 text-4xl font-bold text-primary">{keyCount}+</div>
							<div className="text-muted-foreground">Game Keys</div>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section className="border-b border-border py-20">
				<div className="container mx-auto px-4">
					<div className="mb-12 text-center">
						<h2 className="mb-4 text-3xl font-bold">Why Choose S1Dev Shop?</h2>
						<p className="text-muted-foreground">
							Experience the best in digital gaming products with our premium marketplace
						</p>
					</div>
					<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
						<Card className="border-primary/20 transition-all hover:border-primary/40 hover:shadow-lg">
							<CardHeader>
								<Zap className="mb-2 h-8 w-8 text-primary" />
								<CardTitle>Instant Delivery</CardTitle>
								<CardDescription>
									Get your digital products immediately after payment confirmation
								</CardDescription>
							</CardHeader>
						</Card>
						<Card className="border-primary/20 transition-all hover:border-primary/40 hover:shadow-lg">
							<CardHeader>
								<Shield className="mb-2 h-8 w-8 text-primary" />
								<CardTitle>Secure Payment</CardTitle>
								<CardDescription>
									Safe and encrypted transactions through Omise payment gateway
								</CardDescription>
							</CardHeader>
						</Card>
						<Card className="border-primary/20 transition-all hover:border-primary/40 hover:shadow-lg">
							<CardHeader>
								<Download className="mb-2 h-8 w-8 text-primary" />
								<CardTitle>Easy Access</CardTitle>
								<CardDescription>
									All products available in your order history and email
								</CardDescription>
							</CardHeader>
						</Card>
						<Card className="border-primary/20 transition-all hover:border-primary/40 hover:shadow-lg">
							<CardHeader>
								<CreditCard className="mb-2 h-8 w-8 text-primary" />
								<CardTitle>PromptPay</CardTitle>
								<CardDescription>
									Quick and convenient payment with QR code scanning
								</CardDescription>
							</CardHeader>
						</Card>
					</div>
				</div>
			</section>

			{/* Category Highlights - ตาม Rules SEO: Category descriptions */}
			<section className="border-b border-border bg-card py-20">
				<div className="container mx-auto px-4">
					<div className="mb-12 text-center">
						<h2 className="mb-4 text-3xl font-bold">Shop by Category</h2>
						<p className="text-muted-foreground">
							Browse our wide selection of digital gaming products
						</p>
					</div>
					<div className="grid gap-8 md:grid-cols-3">
						<Card className="group border-primary/20 transition-all hover:border-primary/40 hover:shadow-xl">
							<CardHeader>
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
									<Code className="h-6 w-6 text-primary" />
								</div>
								<CardTitle className="text-2xl">Roblox Scripts</CardTitle>
								<CardDescription className="text-base">
									Automation scripts for Roblox games. Enhance your gameplay with auto-farm, QoL features, 
									and game utilities. Compatible with popular executors including Synapse X, Fluxus, Delta, 
									and other standard Lua executors. Perfect for players looking to automate repetitive tasks 
									and improve their gaming efficiency.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ul className="space-y-2 text-sm text-muted-foreground">
									<li className="flex items-center gap-2">
										<Check className="h-4 w-4 text-primary" />
										Auto-farm scripts
									</li>
									<li className="flex items-center gap-2">
										<Check className="h-4 w-4 text-primary" />
										Quality of Life features
									</li>
									<li className="flex items-center gap-2">
										<Check className="h-4 w-4 text-primary" />
										Game utilities
									</li>
								</ul>
								<Button asChild className="mt-4 w-full" variant="outline">
									<Link href="/products?type=script">
										View Scripts
										<ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
							</CardContent>
						</Card>

						<Card className="group border-primary/20 transition-all hover:border-primary/40 hover:shadow-xl">
							<CardHeader>
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
									<Key className="h-6 w-6 text-primary" />
								</div>
								<CardTitle className="text-2xl">Game Keys & Codes</CardTitle>
								<CardDescription className="text-base">
									Digital game keys, executor keys, and gamepass codes. Instant delivery after payment. 
									Perfect for unlocking premium game content. All keys are verified and ready to use. 
									Compatible with all standard Roblox game platforms.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ul className="space-y-2 text-sm text-muted-foreground">
									<li className="flex items-center gap-2">
										<Check className="h-4 w-4 text-primary" />
										Executor keys
									</li>
									<li className="flex items-center gap-2">
										<Check className="h-4 w-4 text-primary" />
										Gamepass codes
									</li>
									<li className="flex items-center gap-2">
										<Check className="h-4 w-4 text-primary" />
										Premium game content
									</li>
								</ul>
								<Button asChild className="mt-4 w-full" variant="outline">
									<Link href="/products?type=key">
										View Keys
										<ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
							</CardContent>
						</Card>

						<Card className="group border-primary/20 transition-all hover:border-primary/40 hover:shadow-xl">
							<CardHeader>
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
									<Package className="h-6 w-6 text-primary" />
								</div>
								<CardTitle className="text-2xl">Digital Tools & Items</CardTitle>
								<CardDescription className="text-base">
									Various digital items, tools, and utilities for gaming. Browse our collection of verified products 
									with instant delivery. All items are tested and safe to use. Perfect for enhancing your gaming experience.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ul className="space-y-2 text-sm text-muted-foreground">
									<li className="flex items-center gap-2">
										<Check className="h-4 w-4 text-primary" />
										Digital tools
									</li>
									<li className="flex items-center gap-2">
										<Check className="h-4 w-4 text-primary" />
										Gaming utilities
									</li>
									<li className="flex items-center gap-2">
										<Check className="h-4 w-4 text-primary" />
										Verified products
									</li>
								</ul>
								<Button asChild className="mt-4 w-full" variant="outline">
									<Link href="/products">
										View All Items
										<ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</section>

			{/* FAQ Section - ตาม Rules AEO */}
			<section className="border-b border-border py-20">
				<div className="container mx-auto px-4">
					<div className="mx-auto max-w-3xl">
						<div className="mb-12 text-center">
							<h2 className="mb-4 text-3xl font-bold">Frequently Asked Questions</h2>
							<p className="text-muted-foreground">
								Find answers to common questions about our products and services
							</p>
						</div>
						<FAQSection faqs={faqs} />
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="border-b border-border bg-gradient-to-b from-card to-background py-20">
				<div className="container mx-auto px-4">
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="mb-4 text-3xl font-bold">Ready to Get Started?</h2>
						<p className="mb-8 text-lg text-muted-foreground">
							Join thousands of gamers who trust S1Dev Shop for their digital gaming needs
						</p>
						<div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
							{session ? (
								<Button asChild size="lg" className="text-lg">
									<Link href="/products">
										<Package className="mr-2 h-5 w-5" />
										Browse Products
									</Link>
								</Button>
							) : (
								<>
									<Button asChild size="lg" className="text-lg">
										<Link href="/register">
											Create Account
											<ArrowRight className="ml-2 h-5 w-5" />
										</Link>
									</Button>
									<Button asChild variant="outline" size="lg" className="text-lg">
										<Link href="/login">Sign In</Link>
									</Button>
								</>
							)}
						</div>
					</div>
				</div>
			</section>
		</div>
	)
}
