'use server'

import { revalidatePath } from 'next/cache'
import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { authorizeMutation, requireRole } from '@/lib/rbac'
import { MANAGER_ROLES } from '@/lib/auth'
import type { TeamMember, TeamRole } from '@/lib/users'

const PATH = '/dashboard/users'

type ActionResult = { ok: true; publicId?: string } | { ok: false; error: string }

function revalidateTeam() {
  revalidatePath(PATH)
}

function parseTeamRole(value: unknown): TeamRole | null {
  return value === 'USER' || value === 'ADMIN' ? value : null
}

async function sessionCompanyId() {
  const session = await auth()
  const companyId = session?.user?.companyId
  if (!companyId) return null
  return companyId
}

async function findCompanyUser(companyId: number, userId: string) {
  const numericId = Number.parseInt(userId, 10)
  const member = await prisma.user.findFirst({
    where: {
      companyId,
      role: { not: UserRole.SUPER_ADMIN },
      OR: [
        { publicId: userId },
        ...(Number.isInteger(numericId) && String(numericId) === userId ? [{ id: numericId }] : []),
      ],
    },
  })
  if (!member || member.companyId !== companyId) return null
  return member
}

export async function getCompanyUsers(): Promise<TeamMember[]> {
  const companyId = await sessionCompanyId()
  if (!companyId) return []
  const user = await requireRole(MANAGER_ROLES, companyId)

  const rows = await prisma.user.findMany({
    where: {
      companyId: user.companyId,
      role: { not: UserRole.SUPER_ADMIN },
    },
    orderBy: [{ isDeleted: 'asc' }, { name: 'asc' }],
    select: {
      publicId: true,
      name: true,
      pseudo: true,
      email: true,
      role: true,
      isDeleted: true,
      createdAt: true,
    },
  })

  return rows.map((row) => ({
    publicId: row.publicId,
    name: row.name,
    pseudo: row.pseudo,
    email: row.email,
    role: row.role,
    isDeleted: row.isDeleted,
    createdAt: row.createdAt.toISOString(),
    isCurrent: row.publicId === user.publicId,
  }))
}

export async function createUser(data: {
  name: string
  pseudo: string
  email?: string
  password: string
  role: string
}): Promise<ActionResult> {
  const companyId = await sessionCompanyId()
  if (!companyId) return { ok: false, error: 'Session invalide.' }
  const authz = await authorizeMutation(MANAGER_ROLES, null, companyId)
  if (!authz.ok) return authz

  const name = String(data.name ?? '').trim()
  const pseudo = String(data.pseudo ?? '').trim()
  const email = String(data.email ?? '').trim()
  const password = String(data.password ?? '')
  const role = parseTeamRole(data.role)

  if (name.length < 2) return { ok: false, error: 'Le nom est obligatoire.' }
  if (pseudo.length < 3) return { ok: false, error: 'L’identifiant doit contenir au moins 3 caractères.' }
  if (password.length < 8) return { ok: false, error: 'Le mot de passe doit contenir au moins 8 caractères.' }
  if (!role) return { ok: false, error: 'Le rôle est invalide.' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'L’email n’est pas valide.' }
  }

  const clash = await prisma.user.findFirst({
    where: {
      companyId: authz.user.companyId,
      OR: [{ pseudo }, ...(email ? [{ email }] : [])],
    },
    select: { pseudo: true, email: true },
  })
  if (clash?.pseudo === pseudo) return { ok: false, error: 'Cet identifiant est déjà utilisé.' }
  if (email && clash?.email === email) return { ok: false, error: 'Cet email est déjà utilisé.' }

  const created = await prisma.user.create({
    data: {
      companyId: authz.user.companyId,
      name,
      pseudo,
      email: email || null,
      password: await bcrypt.hash(password, 10),
      role,
    },
  })

  revalidateTeam()
  return { ok: true, publicId: created.publicId }
}

export async function updateUserRole(userId: string, role: string): Promise<ActionResult> {
  const companyId = await sessionCompanyId()
  if (!companyId) return { ok: false, error: 'Session invalide.' }
  const authz = await authorizeMutation(MANAGER_ROLES, null, companyId)
  if (!authz.ok) return authz
  const nextRole = parseTeamRole(role)
  if (!nextRole) return { ok: false, error: 'Le rôle est invalide.' }

  const member = await findCompanyUser(authz.user.companyId, userId)
  if (!member || member.companyId !== authz.user.companyId) {
    return { ok: false, error: 'Collaborateur introuvable.' }
  }
  if (member.publicId === authz.user.publicId && nextRole !== 'ADMIN') {
    return { ok: false, error: 'Vous ne pouvez pas retirer votre propre rôle gestionnaire.' }
  }

  if (member.role === UserRole.ADMIN && nextRole === 'USER') {
    const admins = await prisma.user.count({
      where: {
        companyId: authz.user.companyId,
        role: { in: MANAGER_ROLES },
        isDeleted: false,
        NOT: { id: member.id },
      },
    })
    if (admins === 0) return { ok: false, error: 'Il doit rester au moins un gestionnaire actif.' }
  }

  await prisma.user.update({
    where: { id: member.id, companyId: authz.user.companyId },
    data: { role: nextRole },
  })
  revalidateTeam()
  return { ok: true, publicId: member.publicId }
}

export async function toggleUserStatus(userId: string): Promise<ActionResult> {
  const companyId = await sessionCompanyId()
  if (!companyId) return { ok: false, error: 'Session invalide.' }
  const authz = await authorizeMutation(MANAGER_ROLES, null, companyId)
  if (!authz.ok) return authz

  const member = await findCompanyUser(authz.user.companyId, userId)
  if (!member || member.companyId !== authz.user.companyId) {
    return { ok: false, error: 'Collaborateur introuvable.' }
  }
  if (member.publicId === authz.user.publicId) {
    return { ok: false, error: 'Vous ne pouvez pas désactiver votre propre compte.' }
  }

  const nextActive = member.isDeleted
  if (!nextActive && member.role === UserRole.ADMIN) {
    const admins = await prisma.user.count({
      where: {
        companyId: authz.user.companyId,
        role: { in: MANAGER_ROLES },
        isDeleted: false,
        NOT: { id: member.id },
      },
    })
    if (admins === 0) return { ok: false, error: 'Il doit rester au moins un gestionnaire actif.' }
  }

  await prisma.user.update({
    where: { id: member.id, companyId: authz.user.companyId },
    data: nextActive
      ? { isDeleted: false, deletedAt: null }
      : { isDeleted: true, deletedAt: new Date() },
  })
  revalidateTeam()
  return { ok: true, publicId: member.publicId }
}

export const getTeamMembers = getCompanyUsers
export const inviteTeamMember = createUser
export const updateTeamMemberRole = updateUserRole
export async function setTeamMemberActive(userId: string, _active?: boolean) {
  return toggleUserStatus(userId)
}
