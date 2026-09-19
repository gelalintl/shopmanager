import { UserRole } from '@prisma/client'
import type { Session } from 'next-auth'

export type AdminProof = {
  identifier: string
  password?: string
  pin?: string
  reason?: string
}

export const STAFF_ROLES: UserRole[] = [UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN]
export const MANAGER_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN]

export const roleLabels: Record<UserRole, string> = {
  USER: 'Rédacteur / Caisse',
  ADMIN: 'Gestionnaire',
  SUPER_ADMIN: 'Super administrateur',
}

export function isManagerRole(role?: UserRole | null) {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN
}

export function roleAllowed(role: UserRole | null | undefined, allowed: UserRole[]) {
  if (!role) return false
  if (allowed.includes(role)) return true
  if (role === UserRole.SUPER_ADMIN && allowed.includes(UserRole.ADMIN)) return true
  if ((role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) && allowed.includes(UserRole.USER)) {
    return true
  }
  return false
}

export function sessionRole(session: Session | null | undefined): UserRole | null {
  return session?.user?.role ?? null
}
