import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
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

        const pseudo = credentials.pseudo as string
        const password = credentials.password as string

        // Recherche de l'utilisateur avec son entreprise
        const user = await prisma.user.findFirst({
          where: {
            pseudo: pseudo,
            isDeleted: false,
          },
          include: {
            company: true,
          },
        })

        if (!user || !user.password) {
          return null
        }

        // Vérification du mot de passe hashé (compatibilité bcrypt Laravel / Node)
        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) {
          return null
        }

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
        token.role = (user as any).role
        token.companyId = (user as any).companyId
        token.companyName = (user as any).companyName
        token.pseudo = (user as any).pseudo
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
        session.user.id = (token.sub as string) ?? session.user.id
        session.user.name = (token.name as string) ?? session.user.name
        ;(session.user as any).role = token.role
        ;(session.user as any).companyId = token.companyId
        ;(session.user as any).companyName = token.companyName
        ;(session.user as any).pseudo = token.pseudo
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