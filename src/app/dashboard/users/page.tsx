import type { Metadata } from 'next'
import { requirePageRole } from '@/lib/rbac'
import { MANAGER_ROLES } from '@/lib/auth'
import { getCompanyUsers } from '@/app/dashboard/users/actions'
import { TeamWorkspace } from '@/components/users/team-workspace'
import { Heading, Text } from '@/components/ui/typography'

export const metadata: Metadata = {
  title: 'SM | Équipe',
}

export default async function UsersPage() {
  await requirePageRole(MANAGER_ROLES)
  const members = await getCompanyUsers()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <Heading as="h2" size="xl">
          Équipe & accès
        </Heading>
        <Text variant="muted" className="mt-1">
          Invitez des collaborateurs, attribuez un rôle ou désactivez un compte.
        </Text>
      </div>
      <TeamWorkspace members={members} />
    </div>
  )
}
