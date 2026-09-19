import { UserRole } from '@prisma/client'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      pseudo: string
      role: UserRole
      companyId: number
      companyName: string
    } & DefaultSession['user']
  }

  interface User {
    pseudo: string
    role: UserRole
    companyId: number
    companyName: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: UserRole
    companyId?: number
    companyName?: string
    pseudo?: string
  }
}
