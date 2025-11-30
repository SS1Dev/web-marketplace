import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const verifyKeySchema = z.object({
	key: z.string().min(1),
	hwid: z.string().optional(),
	placeId: z.string().optional(),
	gameName: z.string().optional(),
	userId: z.string().optional(),
	userName: z.string().optional(),
})

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url)
		const key = searchParams.get('key') || ''
		const hwid = searchParams.get('hwid') || undefined
		const placeId = searchParams.get('placeId') || undefined
		const gameName = searchParams.get('gameName') || searchParams.get('GameName') || undefined
		const userId = searchParams.get('userId') || undefined
		const userName = searchParams.get('userName') || undefined

		const { 
			key: validatedKey, 
			hwid: validatedHwid, 
			placeId: validatedPlaceId,
			gameName: validatedGameName,
			userId: validatedUserId,
			userName: validatedUserName,
		} = verifyKeySchema.parse({
			key,
			hwid,
			placeId,
			gameName,
			userId,
			userName,
		})

		// Get client IP and User Agent
		const ipAddress =
			req.headers.get('x-forwarded-for') ||
			req.headers.get('x-real-ip') ||
			'unknown'
		const userAgent = req.headers.get('user-agent') || 'unknown'

		// Find key (data is embedded, no need for include)
		const keyRecord = await prisma.key.findUnique({
			where: { key: validatedKey.toUpperCase().trim() },
		})

		if (!keyRecord) {
			// Log failed verification (no keyData for invalid keys)
			await prisma.keyLog.create({
				data: {
					keyId: '', // Will be empty for invalid keys
					keyData: {
						gameName: validatedGameName || null,
						userId: validatedUserId || null,
						userName: validatedUserName || null,
					},
					action: 'verify',
					success: false,
					message: 'Key not found',
					ipAddress,
					userAgent,
				},
			})

			return NextResponse.json(
				{ error: 'Invalid key', success: false },
				{ status: 404 },
			)
		}

		// Check if key is active
		if (!keyRecord.isActive) {
			const productData = keyRecord.productData as any
			const keyData = {
				id: keyRecord.id,
				key: keyRecord.key,
				expireDate: keyRecord.expireDate,
				productData,
				gameName: validatedGameName || null,
				userId: validatedUserId || null,
				userName: validatedUserName || null,
			}
			await prisma.keyLog.create({
				data: {
					keyId: keyRecord.id,
					keyData,
					action: 'verify',
					success: false,
					message: 'Key is inactive',
					ipAddress,
					userAgent,
				},
			})

			return NextResponse.json(
				{ error: 'Key is inactive', success: false },
				{ status: 400 },
			)
		}

		// Check expiration (only if key has been activated)
		const now = new Date()
		if (keyRecord.activateDate && keyRecord.expireDate < now) {
			const productData = keyRecord.productData as any
			const keyData = {
				id: keyRecord.id,
				key: keyRecord.key,
				expireDate: keyRecord.expireDate,
				productData,
				gameName: validatedGameName || null,
				userId: validatedUserId || null,
				userName: validatedUserName || null,
			}
			await prisma.keyLog.create({
				data: {
					keyId: keyRecord.id,
					keyData,
					action: 'verify',
					success: false,
					message: 'Key has expired',
					ipAddress,
					userAgent,
				},
			})

			return NextResponse.json(
				{ error: 'Key has expired', success: false },
				{ status: 400 },
			)
		}

		// Update key with activation info (only on first activation)
		const isFirstActivation = !keyRecord.activateDate
		const updateData: any = {}

		if (isFirstActivation) {
			updateData.activateDate = now
			// Calculate expireDate from activateDate
			const productData = keyRecord.productData as any
			const { calculateExpireDate } = await import('@/lib/key-generator')
			updateData.expireDate = calculateExpireDate(
				productData?.expireDays || null,
				now,
			)
		}

		if (validatedHwid) {
			updateData.hwid = validatedHwid
		}

		if (validatedPlaceId) {
			updateData.placeId = validatedPlaceId
		}

		if (Object.keys(updateData).length > 0) {
			await prisma.key.update({
				where: { id: keyRecord.id },
				data: updateData,
			})
		}

		// Get updated key record if it was just activated
		const updatedKeyRecord = isFirstActivation
			? await prisma.key.findUnique({
					where: { id: keyRecord.id },
				})
			: keyRecord

		// Prepare keyData for logging
		const productData = keyRecord.productData as any
		const keyData = {
			id: keyRecord.id,
			key: keyRecord.key,
			expireDate: updatedKeyRecord?.expireDate || keyRecord.expireDate,
			activateDate: updatedKeyRecord?.activateDate || keyRecord.activateDate || (isFirstActivation ? now : null),
			productData,
			gameName: validatedGameName || null,
			userId: validatedUserId || null,
			userName: validatedUserName || null,
		}

		// Log successful verification
		await prisma.keyLog.create({
			data: {
				keyId: keyRecord.id,
				keyData,
				action: isFirstActivation ? 'activate' : 'verify',
				hwid: validatedHwid || null,
				placeId: validatedPlaceId || null,
				success: true,
				message: isFirstActivation
					? 'Key activated successfully'
					: 'Key verified successfully',
				ipAddress,
				userAgent,
			},
		})

		const finalKeyRecord = updatedKeyRecord || keyRecord

		// Resolve sourceCode:
		// - พยายามอ่านจาก productData ที่ฝังใน key ก่อน
		// - ถ้าไม่มี ให้ไปดึงจาก product ตัวจริงในฐานข้อมูล (รองรับ key เก่า)
		// - ถ้าเป็น GitHub URL จะใช้รูปแบบ fetch แบบมี header + token (ถ้ามี)
		// - อย่างอื่นจะส่งค่าดิบกลับไป
		let resolvedSourceCode: string | null = null
		let rawSource = productData?.sourceCode as string | undefined

		// Fallback: ถ้า key เก่าที่ยังไม่มี sourceCode ใน productData ให้ดึงจาก product โดยตรง
		if (!rawSource && (keyRecord as any).productId) {
			try {
				const product = await prisma.product.findUnique({
					where: { id: (keyRecord as any).productId },
				})
				if (product && (product as any).sourceCode) {
					rawSource = (product as any).sourceCode as string
				}
			} catch {
				// Ignore errors loading product
			}
		}

		if (rawSource) {
			try {
				const isUrl = /^https?:\/\//i.test(rawSource)

				if (isUrl) {
					const urlObj = new URL(rawSource)
					const host = urlObj.hostname.toLowerCase()

					// เฉพาะ GitHub / Raw GitHub เท่านั้นที่ใช้ header ตามตัวอย่าง
					if (host === 'github.com' || host === 'raw.githubusercontent.com') {
						const GITHUB_TOKEN = process.env.GITHUB_TOKEN

						const headers: Record<string, string> = {
							Accept: 'application/vnd.github+json',
							'X-GitHub-Api-Version': '2022-11-28',
						}

						// เพิ่ม Authorization header ถ้ามี token
						if (GITHUB_TOKEN) {
							headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`
						}

						const response = await fetch(rawSource, {
							method: 'GET',
							headers,
						})

						if (!response.ok) {
							throw new Error(
								`GitHub fetch error: ${response.status} ${response.statusText}`,
							)
						}

						resolvedSourceCode = await response.text()
					} else {
						// URL อื่น ๆ ส่งค่าดิบ (เช่น ให้ client ไปจัดการต่อเอง)
						resolvedSourceCode = rawSource
					}
				} else {
					// ไม่ใช่ URL แปลว่าเป็นซอร์สโค้ดตรง ๆ
					resolvedSourceCode = rawSource
				}
			} catch {
				// ถ้า error ให้ fallback เป็นค่าดิบ
				resolvedSourceCode = rawSource
			}
		}

		return NextResponse.json({
			success: true,
			key: {
				id: finalKeyRecord.id,
				key: finalKeyRecord.key,
				activated: !!finalKeyRecord.activateDate,
				activateDate: finalKeyRecord.activateDate || null,
				expireDate: finalKeyRecord.activateDate ? finalKeyRecord.expireDate : null,
				productName: productData?.name || 'Unknown',
				sourceCode: resolvedSourceCode,
				status: finalKeyRecord.activateDate ? 'active' : 'unused',
			},
		})
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.errors },
				{ status: 400 },
			)
		}

		return NextResponse.json(
			{ error: 'Internal server error', success: false },
			{ status: 500 },
		)
	}
}

