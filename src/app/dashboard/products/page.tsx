import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { StatsCard, SummaryCards } from '@/components/dashboard/stats-card'
import { ProductCatalog } from '@/components/products/product-catalog'
import { getProducts } from '@/app/dashboard/products/actions'
import { formatCfa, type StockFilter } from '@/lib/products'
import { parseLimit, parsePage } from '@/lib/pagination'

export const metadata: Metadata = {
  title: 'SM | Produits',
}

const STOCK: StockFilter[] = ['all', 'ok', 'low', 'out']

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; q?: string; stock?: string; sort?: string; dir?: string }>
}) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')

  const params = await searchParams
  const stock = STOCK.includes((params.stock ?? '') as StockFilter)
    ? (params.stock as StockFilter)
    : 'all'
  const result = await getProducts(parsePage(params.page), parseLimit(params.limit), {
    q: params.q,
    stock,
    sort: params.sort,
    dir: params.dir,
  })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <SummaryCards className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard title="Total produits" value={String(result.productCount)} hint="Références actives" />
        <StatsCard title="Valeur totale du stock" value={formatCfa(result.stockValue)} hint="Quantité × PU" />
        <StatsCard
          title="Alertes stock faible"
          value={String(result.lowStockAlerts)}
          hint="Seuil atteint ou rupture"
          tone="warning"
        />
      </SummaryCards>

      <Suspense fallback={null}>
        <ProductCatalog
          products={result.data}
          totalCount={result.totalCount}
          currentPage={result.currentPage}
          limit={parseLimit(params.limit)}
          initialQuery={params.q ?? ''}
          initialStock={stock}
        />
      </Suspense>
    </div>
  )
}
