import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export type TenantContext =
  | { ok: true; user: { id: number; companyId: number } }
  | { ok: false; error: string }

export async function getTenantContext(): Promise<TenantContext> {
  const session = await auth()
  const companyId = session?.user?.companyId
  const pseudo = session?.user?.pseudo
  const publicId = session?.user?.id

  if (!companyId) {
    return { ok: false, error: 'Session invalide.' }
  }

  const user = await prisma.user.findFirst({
    where: {
      companyId,
      isDeleted: false,
      ...(publicId ? { publicId } : { pseudo: pseudo ?? '' }),
    },
    select: { id: true, companyId: true },
  })

  if (!user) {
    return { ok: false, error: 'Utilisateur introuvable.' }
  }

  return { ok: true, user }
}
