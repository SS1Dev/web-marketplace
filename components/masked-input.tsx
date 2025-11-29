'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface MaskedInputProps {
	value: string
	label?: string
	maskChar?: string
	className?: string
}

export function MaskedInput({
	value,
	label,
	maskChar = '•',
	className,
}: MaskedInputProps) {
	const [isVisible, setIsVisible] = useState(false)
	const [isCopied, setIsCopied] = useState(false)
	const { toast } = useToast()

	const displayValue = isVisible ? value : maskChar.repeat(value.length)

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(value)
			setIsCopied(true)
			toast({
				title: 'Copied',
				description: 'Value copied to clipboard',
				variant: 'success',
			})
			setTimeout(() => setIsCopied(false), 2000)
		} catch (error) {
			toast({
				title: 'Error',
				description: 'Failed to copy to clipboard',
				variant: 'destructive',
			})
		}
	}

	return (
		<div className={className}>
			{label && (
				<label className="mb-2 block text-sm font-medium">{label}</label>
			)}
			<div className="flex items-center space-x-2">
				<div className="relative flex-1">
					<Input
						type="text"
						value={displayValue}
						readOnly
						className="font-mono pr-20"
					/>
					<div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={() => setIsVisible(!isVisible)}
						>
							{isVisible ? (
								<EyeOff className="h-4 w-4" />
							) : (
								<Eye className="h-4 w-4" />
							)}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={handleCopy}
						>
							{isCopied ? (
								<Check className="h-4 w-4 text-green-500" />
							) : (
								<Copy className="h-4 w-4" />
							)}
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}

