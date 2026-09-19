import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { MANAGER_ROLES, roleAllowed, type AdminProof } from '@/lib/auth'
import { getTenantContext, type TenantUser } from '@/lib/tenant'

export class AuthorizationError extends Error {
  constructor(message = 'Non autorisé.') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export type { AdminProof }

export type AuthorizedActor =
  | { ok: true; user: TenantUser; actorId: number; reason: string | null }
  | { ok: false; error: string }

export function assertSameCompany(
  actorCompanyId: number,
  resourceCompanyId: number | null | undefined,
) {
  return resourceCompanyId != null && resourceCompanyId === actorCompanyId
}

export async function checkRole(allowedRoles: UserRole[]): Promise<boolean> {
  const session = await auth()
  return roleAllowed(session?.user?.role, allowedRoles)
}

export async function requireRole(
  allowedRoles: UserRole[],
  resourceCompanyId?: number | null,
): Promise<TenantUser> {
  const ctx = await getTenantContext()
  if (!ctx.ok) throw new AuthorizationError(ctx.error)
  if (!roleAllowed(ctx.user.role, allowedRoles)) {
    throw new AuthorizationError()
  }
  if (resourceCompanyId != null && resourceCompanyId !== ctx.user.companyId) {
    throw new AuthorizationError('Ressource hors de votre entreprise.')
  }
  return ctx.user
}

export async function requirePageRole(allowedRoles: UserRole[]) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  if (!roleAllowed(session.user.role, allowedRoles)) redirect('/dashboard')
  return session.user
}

export async function authorizeMutation(
  allowedRoles: UserRole[],
  proof?: AdminProof | null,
  resourceCompanyId?: number | null,
): Promise<AuthorizedActor> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  if (resourceCompanyId != null && resourceCompanyId !== ctx.user.companyId) {
    return { ok: false, error: 'Ressource hors de votre entreprise.' }
  }

  if (roleAllowed(ctx.user.role, allowedRoles)) {
    return {
      ok: true,
      user: ctx.user,
      actorId: ctx.user.id,
      reason: proof?.reason?.trim() || null,
    }
  }

  const secret = proof?.password?.trim() || proof?.pin?.trim() || ''
  if (!proof?.identifier?.trim() || !secret) {
    return { ok: false, error: 'Validation administrateur requise.' }
  }

  const admin = await verifyCompanyManager(ctx.user.companyId, proof)
  if (!admin) {
    return { ok: false, error: 'Identifiants administrateur invalides.' }
  }
  if (admin.companyId !== ctx.user.companyId) {
    return { ok: false, error: 'Identifiants administrateur invalides.' }
  }

  return {
    ok: true,
    user: ctx.user,
    actorId: admin.id,
    reason: proof.reason?.trim() || null,
  }
}

export async function verifyCompanyManager(companyId: number, proof: AdminProof) {
  const identifier = proof.identifier.trim()
  const secret = (proof.password || proof.pin || '').trim()
  if (!identifier || !secret || !companyId) return null

  const admin = await prisma.user.findFirst({
    where: {
      companyId,
      isDeleted: false,
      role: { in: MANAGER_ROLES },
      OR: [
        { pseudo: { equals: identifier, mode: 'insensitive' } },
        { email: { equals: identifier, mode: 'insensitive' } },
      ],
    },
    select: { id: true, companyId: true, role: true, password: true },
  })

  if (!admin || admin.companyId !== companyId) return null
  if (admin.role !== UserRole.ADMIN && admin.role !== UserRole.SUPER_ADMIN) return null

  const valid = await bcrypt.compare(secret, admin.password)
  return valid ? { id: admin.id, companyId: admin.companyId } : null
}
