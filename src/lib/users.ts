import { UserRole } from '@prisma/client'

export type TeamRole = Extract<UserRole, 'USER' | 'ADMIN'>

export type TeamMember = {
  publicId: string
  name: string
  pseudo: string
  email: string | null
  role: UserRole
  isDeleted: boolean
  createdAt: string
  isCurrent: boolean
}

export const teamRoleOptions: { id: TeamRole; label: string }[] = [
  { id: 'USER', label: 'Rédacteur / Caisse' },
  { id: 'ADMIN', label: 'Gestionnaire' },
]
