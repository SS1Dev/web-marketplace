'use client'

import { useState } from 'react'
import { StructuredData } from './structured-data'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FAQItem {
	question: string
	answer: string
}

interface FAQSectionProps {
	faqs: FAQItem[]
	title?: string
	className?: string
}

export function FAQSection({ faqs, title = 'Frequently Asked Questions', className }: FAQSectionProps) {
	const [openIndex, setOpenIndex] = useState<number | null>(null)

	const toggleFAQ = (index: number) => {
		setOpenIndex(openIndex === index ? null : index)
	}

	// Generate FAQ structured data for AEO (ตาม Rules)
	const faqSchema = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqs.map((faq) => ({
			'@type': 'Question',
			name: faq.question,
			acceptedAnswer: {
				'@type': 'Answer',
				text: faq.answer,
			},
		})),
	}

	return (
		<div className={cn('w-full', className)}>
			<StructuredData data={faqSchema} />
			<h2 className="mb-6 text-2xl font-bold">{title}</h2>
			<div className="space-y-4">
				{faqs.map((faq, index) => (
					<div
						key={index}
						className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
					>
						<button
							onClick={() => toggleFAQ(index)}
							className="flex w-full items-center justify-between text-left"
							aria-expanded={openIndex === index}
							aria-controls={`faq-answer-${index}`}
						>
							<span className="pr-8 font-semibold">{faq.question}</span>
							<ChevronDown
								className={cn(
									'h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform',
									openIndex === index && 'rotate-180'
								)}
							/>
						</button>
						<div
							id={`faq-answer-${index}`}
							className={cn(
								'overflow-hidden transition-all duration-300',
								openIndex === index ? 'mt-4 max-h-96 opacity-100' : 'max-h-0 opacity-0'
							)}
						>
							<p className="whitespace-pre-line text-muted-foreground">{faq.answer}</p>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

