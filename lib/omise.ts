const OMISE_API_URL = 'https://api.omise.co'

function getOmiseAuth() {
	if (!process.env.OMISE_SECRET_KEY) {
		throw new Error('OMISE_SECRET_KEY is not set')
	}

	const secretKey = process.env.OMISE_SECRET_KEY
	const auth = Buffer.from(`${secretKey}:`).toString('base64')
	return `Basic ${auth}`
}

export interface CreatePromptpayChargeParams {
	amount: number // in THB
	orderId: string
	description?: string // Product names for description
}

/**
 * Create a PromptPay charge following Omise standards
 * According to Omise PromptPay documentation:
 * - Amount must be in subunits (satang) - minimum 2000 (THB20.00), maximum 15000000 (THB150,000.00)
 * - Currency must be THB
 * - Source type must be 'promptpay'
 * - Creates source and charge in a single API request (server-side)
 */
export async function createPromptpayCharge({
	amount,
	orderId,
	description,
}: CreatePromptpayChargeParams) {
	try {
		// Convert amount to satang (subunits)
		const amountInSatang = Math.round(amount * 100)

		// Validate amount limits according to Omise PromptPay specifications
		if (amountInSatang < 2000) {
			throw new Error('Amount must be at least THB20.00')
		}
		if (amountInSatang > 15000000) {
			throw new Error('Amount must not exceed THB150,000.00')
		}

		// Create charge with PromptPay source inline (server-side approach)
		// This follows Omise documentation: "If both the creation and charge of a source
		// must happen server-side, you can create and charge the source in a single API request"
		const requestBody: any = {
			amount: amountInSatang,
			currency: 'THB', // Omise PromptPay requires THB currency
			source: {
				type: 'promptpay',
			},
			metadata: {
				orderId,
			},
		}

		// Add description if provided
		if (description) {
			requestBody.description = description
		}

		const response = await fetch(`${OMISE_API_URL}/charges`, {
			method: 'POST',
			headers: {
				'Authorization': getOmiseAuth(),
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(requestBody),
		})

		if (!response.ok) {
			let errorData
			try {
				errorData = await response.json()
			} catch {
				// If response is not JSON, create a generic error
				errorData = {
					message: `Omise API returned status ${response.status}`,
					code: response.status,
				}
			}

			console.error('Omise API error:', {
				status: response.status,
				statusText: response.statusText,
				error: errorData,
			})

			// Create error with Omise error details
			const error = new Error(errorData.message || 'Failed to create charge')
			;(error as any).omiseError = errorData
			;(error as any).statusCode = response.status
			throw error
		}

		const charge = await response.json()

		// Extract QR code URL according to Omise documentation:
		// charge.source.scannable_code.image.download_uri
		const qrCodeUrl = charge.source?.scannable_code?.image?.download_uri || null

		return {
			id: charge.id,
			status: charge.status,
			authorize_uri: charge.authorize_uri,
			qr_code_url: qrCodeUrl,
			expires_at: charge.expires_at, // QR code expiration time (default: 24 hours from creation)
			// Include additional charge data for webhook reference
			paid: charge.paid,
			source_charge_status: charge.source?.charge_status,
		}
	} catch (error) {
		console.error('Omise error:', error)
		throw error
	}
}

export async function getChargeStatus(chargeId: string) {
	try {
		const response = await fetch(`${OMISE_API_URL}/charges/${chargeId}`, {
			method: 'GET',
			headers: {
				'Authorization': getOmiseAuth(),
			},
		})

		if (!response.ok) {
			let errorData
			try {
				errorData = await response.json()
			} catch {
				errorData = {
					message: `Omise API returned status ${response.status}`,
					code: response.status,
				}
			}

			console.error('Omise API error (getChargeStatus):', {
				chargeId,
				status: response.status,
				error: errorData,
			})

			const error = new Error(errorData.message || 'Failed to retrieve charge')
			;(error as any).omiseError = errorData
			;(error as any).statusCode = response.status
			throw error
		}

		const charge = await response.json()
		return {
			id: charge.id,
			status: charge.status,
			paid: charge.paid,
			paid_at: charge.paid_at,
			expires_at: charge.expires_at, // QR code expiration time
			source_charge_status: charge.source?.charge_status,
		}
	} catch (error) {
		console.error('Omise error:', error)
		throw error
	}
}

/**
 * Cancel an Omise charge using the charge ID
 * @param chargeId - The Omise charge ID (omiseChargeId from order)
 * @returns Charge cancellation result
 */
export async function cancelCharge(chargeId: string) {
	if (!chargeId) {
		throw new Error('Charge ID is required')
	}

	try {
		console.log(`Calling Omise API to cancel charge: ${chargeId}`)
		const response = await fetch(`${OMISE_API_URL}/charges/${chargeId}/mark_as_failed`, {
			method: 'POST',
			headers: {
				'Authorization': getOmiseAuth(),
				'Content-Type': 'application/json',
			},
		})

		if (!response.ok) {
			const error = await response.json()
			console.error(`Omise API error for charge ${chargeId}:`, error)
			
			// If charge is already cancelled or paid, that's okay
			if (error.code === 'bad_request' && (
				error.message?.includes('already') || 
				error.message?.includes('cannot be cancelled') ||
				error.message?.includes('paid')
			)) {
				console.log(`Charge ${chargeId} cannot be cancelled (may already be cancelled or paid)`)
				return { 
					success: true, 
					message: 'Charge already processed',
					chargeId,
				}
			}
			throw new Error(error.message || `Failed to cancel charge: ${error.code || 'unknown error'}`)
		}

		const charge = await response.json()
		console.log(`Omise charge ${chargeId} cancelled successfully, status: ${charge.status}`)
		return {
			success: true,
			id: charge.id,
			status: charge.status,
			chargeId,
		}
	} catch (error) {
		console.error(`Omise cancel error for charge ${chargeId}:`, error)
		throw error
	}
}

