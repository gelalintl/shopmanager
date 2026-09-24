import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { StatsCard, SummaryCards } from '@/components/dashboard/stats-card'
import { PaymentJournal } from '@/components/payments/payment-journal'
import { getPaymentsJournal } from '@/app/dashboard/payments/actions'
import { formatCfa } from '@/lib/invoices'
import { PAYMENT_METHODS, paymentMethodLabels, type PaymentMethodFilter } from '@/lib/payments'
import { parseLimit, parsePage } from '@/lib/pagination'

export const metadata: Metadata = {
  title: 'SM | Règlements',
}

function parseMethod(value?: string): PaymentMethodFilter {
  if (value && (PAYMENT_METHODS as string[]).includes(value)) return value as PaymentMethodFilter
  return 'all'
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    limit?: string
    from?: string
    to?: string
    customerId?: string
    method?: string
    sort?: string
    dir?: string
  }>
}) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')

  const params = await searchParams
  const limit = parseLimit(params.limit)
  const paymentMethod = parseMethod(params.method)
  const journal = await getPaymentsJournal(
    {
      from: params.from,
      to: params.to,
      customerPublicId: params.customerId,
      paymentMethod,
      sort: params.sort,
      dir: params.dir,
    },
    parsePage(params.page),
    limit,
  )
  const methodHint = [
    `${paymentMethodLabels.BANK_TRANSFER} ${formatCfa(journal.byMethod.BANK_TRANSFER)}`,
    `${paymentMethodLabels.MOBILE_MONEY} ${formatCfa(journal.byMethod.MOBILE_MONEY)}`,
    `${paymentMethodLabels.CHECK} ${formatCfa(journal.byMethod.CHECK)}`,
  ].join(' · ')

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <SummaryCards className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard
          title="Total encaissé (mois)"
          value={formatCfa(journal.monthTotal)}
          hint="Collections du mois en cours"
          tone="success"
        />
        <StatsCard
          title="Ventilation"
          value={`${paymentMethodLabels.CASH} ${formatCfa(journal.byMethod.CASH)}`}
          hint={methodHint}
        />
        <StatsCard
          title="Reste à recouvrer"
          value={formatCfa(journal.outstanding)}
          hint="Factures non soldées"
          tone={journal.outstanding > 0 ? 'warning' : 'success'}
        />
      </SummaryCards>
      <Suspense fallback={null}>
        <PaymentJournal
          entries={journal.entries}
          customers={journal.customers}
          totalCount={journal.totalCount}
          currentPage={journal.currentPage}
          limit={limit}
          initialFrom={params.from ?? ''}
          initialTo={params.to ?? ''}
          initialCustomerId={params.customerId ?? ''}
          initialMethod={paymentMethod}
        />
      </Suspense>
    </div>
  )
}
