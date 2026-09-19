import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'shopmanager_dev_secret_key_2026',
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        pseudo: { label: 'Identifiant', type: 'text' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.pseudo || !credentials?.password) {
          return null
        }

        const identifier = String(credentials.pseudo).trim()
        const password = credentials.password as string
        if (!identifier || !password) return null

        const candidates = await prisma.user.findMany({
          where: {
            isDeleted: false,
            company: { isActive: true },
            OR: [
              { pseudo: identifier },
              { email: { equals: identifier, mode: 'insensitive' } },
            ],
          },
          include: { company: true },
          take: 5,
        })

        const matched: typeof candidates = []
        for (const candidate of candidates) {
          if (!candidate.password) continue
          const isValid = await bcrypt.compare(password, candidate.password)
          if (isValid) matched.push(candidate)
        }
        if (matched.length !== 1) return null

        const user = matched[0]
        if (!user.companyId || user.companyId !== user.company.id) return null

        return {
          id: user.publicId,
          name: user.name,
          pseudo: user.pseudo,
          role: user.role,
          companyId: user.companyId,
          companyName: user.company.name,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role
        token.companyId = user.companyId
        token.companyName = user.companyName
        token.pseudo = user.pseudo
      }
      if (trigger === 'update' && session) {
        const next = session as { name?: string; pseudo?: string; companyName?: string }
        if (typeof next.name === 'string') token.name = next.name
        if (typeof next.pseudo === 'string') token.pseudo = next.pseudo
        if (typeof next.companyName === 'string') token.companyName = next.companyName
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id
        session.user.name = token.name ?? session.user.name
        if (token.role) session.user.role = token.role as UserRole
        const companyId =
          typeof token.companyId === 'number' ? token.companyId : Number(token.companyId)
        if (Number.isInteger(companyId) && companyId > 0) session.user.companyId = companyId
        if (typeof token.companyName === 'string') session.user.companyName = token.companyName
        if (typeof token.pseudo === 'string') session.user.pseudo = token.pseudo
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
})
