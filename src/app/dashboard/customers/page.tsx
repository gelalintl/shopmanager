import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { StatsCard } from '@/components/dashboard/stats-card'
import { CustomerCatalog } from '@/components/customers/customer-catalog'
import { getCustomers } from '@/app/dashboard/customers/actions'
import { formatCfa } from '@/lib/invoices'
import type { CustomerTypeFilter } from '@/lib/customers'
import { parseLimit, parsePage } from '@/lib/pagination'

export const metadata: Metadata = {
  title: 'SM | Clients',
}

const TYPES: CustomerTypeFilter[] = ['all', 'COMPANY', 'INDIVIDUAL']

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; q?: string; type?: string; sort?: string; dir?: string }>
}) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')

  const params = await searchParams
  const type = TYPES.includes((params.type ?? '') as CustomerTypeFilter)
    ? (params.type as CustomerTypeFilter)
    : 'all'
  const result = await getCustomers(parsePage(params.page), parseLimit(params.limit), {
    q: params.q,
    type,
    sort: params.sort,
    dir: params.dir,
  })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard title="Total clients" value={String(result.customerCount)} hint="Fiches actives" />
        <StatsCard
          title="Répartition"
          value={`${result.companies} / ${result.individuals}`}
          hint="Entreprises / Particuliers"
        />
        <StatsCard
          title="Chiffre d’affaires cumulé"
          value={formatCfa(result.billed)}
          hint={`Reste à recouvrer : ${formatCfa(result.remaining)}`}
          tone={result.remaining > 0 ? 'warning' : 'success'}
        />
      </div>

      <Suspense fallback={null}>
        <CustomerCatalog
          customers={result.data}
          totalCount={result.totalCount}
          currentPage={result.currentPage}
          limit={parseLimit(params.limit)}
          initialQuery={params.q ?? ''}
          initialType={type}
        />
      </Suspense>
    </div>
  )
}
