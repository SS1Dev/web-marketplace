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

export async function createPromptpayCharge({
	amount,
	orderId,
	description,
}: CreatePromptpayChargeParams) {
	try {
		const requestBody: any = {
			amount: Math.round(amount * 100), // Convert to satang
			currency: 'thb',
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
			const error = await response.json()
			throw new Error(error.message || 'Failed to create charge')
		}

		const charge = await response.json()

		return {
			id: charge.id,
			status: charge.status,
			authorize_uri: charge.authorize_uri,
			qr_code_url: charge.source?.scannable_code?.image?.download_uri,
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
			const error = await response.json()
			throw new Error(error.message || 'Failed to retrieve charge')
		}

		const charge = await response.json()
		return {
			id: charge.id,
			status: charge.status,
			paid: charge.paid,
			paid_at: charge.paid_at,
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

