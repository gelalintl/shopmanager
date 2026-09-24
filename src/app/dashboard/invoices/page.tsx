import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { StatsCard, SummaryCards } from '@/components/dashboard/stats-card'
import { InvoiceWorkspace } from '@/components/invoices/invoice-workspace'
import { getDocuments } from '@/app/dashboard/invoices/actions'
import { formatCfa, type InvoiceTab } from '@/lib/invoices'
import { parseLimit, parsePage } from '@/lib/pagination'

export const metadata: Metadata = {
  title: 'SM | Devis & Factures',
}

const TABS: InvoiceTab[] = ['all', 'devis', 'factures', 'pending', 'paid', 'drafts', 'cancellations']

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string
    startDate?: string
    endDate?: string
    customerId?: string
    q?: string
    kind?: string
    page?: string
    limit?: string
    sort?: string
    dir?: string
  }>
}) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')

  const params = await searchParams
  const initialTab = TABS.includes((params.tab ?? '') as InvoiceTab)
    ? (params.tab as InvoiceTab)
    : 'all'
  const limit = parseLimit(params.limit)

  const result = await getDocuments(
    {
      status: initialTab,
      kind: params.kind,
      startDate: params.startDate,
      endDate: params.endDate,
      customerId: params.customerId,
      searchQuery: params.q,
      sort: params.sort,
      dir: params.dir,
    },
    parsePage(params.page),
    limit,
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <SummaryCards className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard title="Chiffre d'affaires facturé" value={formatCfa(result.billed)} hint="Factures émises" />
        <StatsCard title="Devis en attente" value={String(result.pendingQuotes)} hint="Proformas, envoyés, acceptés" />
        <StatsCard title="Reste à recouvrer" value={formatCfa(result.outstanding)} hint="Impayé + acomptes" tone="warning" />
      </SummaryCards>
      <Suspense fallback={null}>
        <InvoiceWorkspace
          documents={result.documents}
          customers={result.customers}
          totalCount={result.totalCount}
          currentPage={result.currentPage}
          limit={limit}
          initialTab={initialTab}
          cancellationCount={result.cancellationCount}
          initialFilters={{
            startDate: params.startDate ?? '',
            endDate: params.endDate ?? '',
            customerId: params.customerId ?? '',
            searchQuery: params.q ?? '',
          }}
        />
      </Suspense>
    </div>
  )
}
