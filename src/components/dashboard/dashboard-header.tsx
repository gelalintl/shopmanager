'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Heading, Text } from '@/components/ui/typography'
import { cn } from '@/lib/cn'
import type { DashboardPeriod } from '@/lib/analytics'

const periods: { id: DashboardPeriod; label: string }[] = [
  { id: 'month', label: 'Mois en cours' },
  { id: 'year', label: 'Année' },
]

type DashboardHeaderProps = {
  name: string
  company?: string | null
  todayLabel: string
  period: DashboardPeriod
}

export function DashboardHeader({ name, company, todayLabel, period }: DashboardHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setPeriod(next: DashboardPeriod) {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'month') params.delete('period')
    else params.set('period', next)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Heading as="h2" size="xl">
          Bonjour, {name}
        </Heading>
        <Text variant="muted" className="mt-1 capitalize">
          {todayLabel}
        </Text>
        {company ? (
          <Text variant="muted" size="sm" className="mt-1">
            Aperçu de l’activité de {company}.
          </Text>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Période">
        {periods.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPeriod(item.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-bold transition-all duration-200',
              period === item.id
                ? 'border-primary bg-primary text-white'
                : 'border-subtle-border bg-white text-foreground hover:border-primary hover:text-primary',
            )}
          >
            {item.label}
          </button>
        ))}
        <Link
          href="/dashboard/reports"
          className="rounded-full border border-subtle-border bg-white px-3 py-1.5 text-sm font-bold text-primary hover:border-primary"
        >
          Rapports
        </Link>
      </div>
    </div>
  )
}
