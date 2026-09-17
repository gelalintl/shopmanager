import { RoleName } from '@prisma/client'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      pseudo: string
      role: RoleName
      companyId: number
      companyName: string
    } & DefaultSession['user']
  }

  interface User {
    pseudo: string
    role: RoleName
    companyId: number
    companyName: string
  }
}