/**
 * Generate a unique key code
 */
export function generateKey(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
	let key = ''
	
	// Generate format: XXXX-XXXX-XXXX-XXXX
	for (let i = 0; i < 4; i++) {
		if (i > 0) key += '-'
		for (let j = 0; j < 4; j++) {
			key += chars.charAt(Math.floor(Math.random() * chars.length))
		}
	}
	
	return key
}

/**
 * Calculate expiration date based on expireDays and activateDate
 * This should only be called when the key is activated (has activateDate)
 */
export function calculateExpireDate(
	expireDays: string | null,
	activateDate: Date,
): Date {
	if (!expireDays || expireDays === 'Never') {
		// Set to 100 years from activation (effectively never)
		const date = new Date(activateDate)
		date.setFullYear(date.getFullYear() + 100)
		return date
	}

	const days = parseInt(expireDays.replace('D', ''))
	if (isNaN(days)) {
		throw new Error(`Invalid expireDays format: ${expireDays}`)
	}

	const expireDate = new Date(activateDate)
	expireDate.setDate(expireDate.getDate() + days)
	return expireDate
}

