import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getDashboardAnalytics } from '@/app/dashboard/actions'
import { StatsCard, SummaryCards } from '@/components/dashboard/stats-card'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { PaymentMethodsDonut } from '@/components/dashboard/payment-methods-donut'
import { TopProductsCard } from '@/components/dashboard/top-products-card'
import { OverdueInvoicesWidget } from '@/components/dashboard/overdue-invoices-widget'
import { RecentActivityFeed } from '@/components/dashboard/recent-activity-feed'
import { formatCfa } from '@/lib/invoices'
import type { DashboardPeriod } from '@/lib/analytics'

export const metadata: Metadata = {
  title: 'SM | Tableau de bord',
}

function IconCash() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 4.7 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.7a2 2 0 0 0-3.4 0Z" />
    </svg>
  )
}

function IconQuotes() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h8l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M15 3v5h5M8 13h8M8 17h5" />
    </svg>
  )
}

function IconToday() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')

  const { period: periodParam } = await searchParams
  const period: DashboardPeriod = periodParam === 'year' ? 'year' : 'month'
  const analytics = await getDashboardAnalytics(period)
  const name = session.user.name || session.user.pseudo || 'utilisateur'

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Suspense fallback={null}>
        <DashboardHeader
          name={name}
          company={session.user.companyName}
          todayLabel={analytics.todayLabel}
          period={period}
        />
      </Suspense>

      <SummaryCards className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="CA encaissé (mois)"
          value={formatCfa(analytics.monthCollected)}
          hint={`Facturé ${formatCfa(analytics.billed)} · Reste ${formatCfa(analytics.remaining)}`}
          tone="success"
          icon={<IconCash />}
        />
        <StatsCard
          title="Factures en souffrance"
          value={formatCfa(analytics.overdueAmount)}
          hint={`${analytics.overdueCount} facture${analytics.overdueCount > 1 ? 's' : ''} en retard`}
          tone="warning"
          icon={<IconAlert />}
        />
        <StatsCard
          title="Devis en attente"
          value={String(analytics.pendingQuotesCount)}
          hint={formatCfa(analytics.pendingQuotesAmount)}
          icon={<IconQuotes />}
        />
        <StatsCard
          title="Encaissements du jour"
          value={formatCfa(analytics.todayCollected)}
          hint="Collections du jour"
          icon={<IconToday />}
        />
      </SummaryCards>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart points={analytics.history} />
        </div>
        <PaymentMethodsDonut methods={analytics.methods} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <TopProductsCard products={analytics.topProducts} />
        <div className="xl:col-span-2">
          <OverdueInvoicesWidget invoices={analytics.overdueInvoices} />
        </div>
      </div>

      <RecentActivityFeed items={analytics.activity} />
    </div>
  )
}
