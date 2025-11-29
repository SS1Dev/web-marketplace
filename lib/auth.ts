import type { NextAuthOptions } from 'next-auth'
import DiscordProvider from 'next-auth/providers/discord'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
	adapter: PrismaAdapter(prisma),
	providers: [
		DiscordProvider({
			clientId: process.env.DISCORD_CLIENT_ID || '',
			clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
		}),
		CredentialsProvider({
			name: 'Credentials',
			credentials: {
				email: { label: 'Email', type: 'email' },
				password: { label: 'Password', type: 'password' },
			},
			async authorize(credentials) {
				if (!credentials?.email || !credentials?.password) {
					return null
				}

				const user = await prisma.user.findUnique({
					where: { email: credentials.email },
				})

				if (!user) {
					return null
				}

				// For demo purposes, we'll check if password matches
				// In production, you should hash passwords properly
				const isValid = await bcrypt.compare(
					credentials.password,
					user.password || '',
				)

				if (!isValid) {
					return null
				}

				return {
					id: user.id,
					email: user.email,
					name: user.name,
					image: user.image,
					role: user.role,
				}
			},
		}),
	],
	callbacks: {
		async signIn({ user, account, profile, email }) {
			// If OAuth provider (Discord)
			if (account?.provider === 'discord' && user.email) {
				// Check if user exists with this email
				const existingUser = await prisma.user.findUnique({
					where: { email: user.email },
					include: { accounts: true },
				})

				if (existingUser) {
					// Check if Discord account is already linked
					const discordAccount = existingUser.accounts.find(
						(acc) => acc.provider === 'discord',
					)

					if (!discordAccount) {
						// Link Discord account to existing user
						await prisma.account.create({
							data: {
								userId: existingUser.id,
								type: account.type,
								provider: account.provider,
								providerAccountId: account.providerAccountId,
								access_token: account.access_token,
								refresh_token: account.refresh_token,
								expires_at: account.expires_at,
								token_type: account.token_type,
								scope: account.scope,
								id_token: account.id_token,
								session_state: account.session_state,
							},
						})

						// Update user info if needed
						if (!existingUser.image && user.image) {
							await prisma.user.update({
								where: { id: existingUser.id },
								data: { image: user.image },
							})
						}
						if (!existingUser.name && user.name) {
							await prisma.user.update({
								where: { id: existingUser.id },
								data: { name: user.name },
							})
						}
					}

					// Update user object to use existing user ID
					user.id = existingUser.id
					user.role = existingUser.role
				}
			}

			return true
		},
		async session({ session, token }) {
			if (session.user && token) {
				session.user.id = token.sub || ''
				session.user.role = token.role as string
			}
			return session
		},
		async jwt({ token, user, account }) {
			if (user) {
				token.id = user.id
				token.role = user.role
			}
			return token
		},
	},
	events: {
		async linkAccount({ user, account, profile }) {
			// Account linked successfully
			console.log('Account linked:', { userId: user.id, provider: account.provider })
		},
	},
	pages: {
		signIn: '/login',
	},
	session: {
		strategy: 'jwt',
	},
}

