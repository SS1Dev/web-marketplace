'use client'

import {
	Toast,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

export function Toaster() {
	const { toasts } = useToast()

	return (
		<ToastProvider>
			{toasts.map(function ({ id, title, description, action, variant, ...props }) {
				// Get icon based on variant with theme colors
				let icon = null
				if (variant === 'success') {
					icon = <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
				} else if (variant === 'destructive') {
					icon = <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
				} else {
					icon = <Info className="h-5 w-5 text-primary flex-shrink-0" />
				}

				return (
					<Toast key={id} variant={variant} {...props}>
						<div className="flex items-start gap-3 w-full">
							<div className="flex-shrink-0 mt-0.5">{icon}</div>
							<div className="grid gap-1 flex-1 min-w-0">
								{title && <ToastTitle>{title}</ToastTitle>}
								{description && (
									<ToastDescription>{description}</ToastDescription>
								)}
							</div>
						</div>
						{action}
						<ToastClose />
					</Toast>
				)
			})}
			<ToastViewport />
		</ToastProvider>
	)
}

