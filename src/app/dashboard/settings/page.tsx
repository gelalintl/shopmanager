import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { requirePageRole } from '@/lib/rbac'
import { MANAGER_ROLES } from '@/lib/auth'
import { getSettings } from '@/app/dashboard/settings/actions'
import { SettingsWorkspace } from '@/components/settings/settings-workspace'
import { parseSettingsTab } from '@/lib/settings'
import { Heading, Text } from '@/components/ui/typography'

export const metadata: Metadata = {
  title: 'SM | Paramètres',
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  await requirePageRole(MANAGER_ROLES)

  const { tab: tabParam } = await searchParams
  const tab = parseSettingsTab(tabParam)
  const settings = await getSettings()
  if (!settings) redirect('/login')

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <Heading as="h2" size="xl">
          Paramètres & personnalisation
        </Heading>
        <Text variant="muted" className="mt-1">
          Identité de l’entreprise, mentions fiscales et modèle d’impression A4.
        </Text>
      </div>
      <Suspense fallback={null}>
        <SettingsWorkspace tab={tab} settings={settings} />
      </Suspense>
    </div>
  )
}
