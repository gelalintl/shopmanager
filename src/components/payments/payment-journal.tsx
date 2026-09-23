'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PaymentFilters } from '@/components/payments/payment-filters'
import { PaymentTable } from '@/components/payments/payment-table'
import { Pagination } from '@/components/ui/pagination'
import type { PaymentJournalEntry, PaymentMethodFilter } from '@/lib/payments'

type PaymentJournalProps = {
  entries: PaymentJournalEntry[]
  customers: Array<{ publicId: string; name: string }>
  totalCount: number
  currentPage: number
  limit: number
  initialFrom?: string
  initialTo?: string
  initialCustomerId?: string
  initialMethod?: PaymentMethodFilter
}

export function PaymentJournal({
  entries,
  customers,
  totalCount,
  currentPage,
  limit,
  initialFrom = '',
  initialTo = '',
  initialCustomerId = '',
  initialMethod = 'all',
}: PaymentJournalProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') ?? initialFrom
  const to = searchParams.get('to') ?? initialTo
  const customerPublicId = searchParams.get('customerId') ?? initialCustomerId
  const paymentMethod = (searchParams.get('method') as PaymentMethodFilter) || initialMethod

  const replaceParams = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return (
    <section className="flex flex-col gap-4">
      <PaymentFilters
        from={from}
        to={to}
        customerPublicId={customerPublicId}
        paymentMethod={paymentMethod}
        customers={customers}
        onChange={(next) => {
          replaceParams({
            from: next.from,
            to: next.to,
            customerId: next.customerPublicId,
            method: next.paymentMethod === 'all' ? '' : next.paymentMethod,
            page: '',
          })
        }}
      />
      <Pagination totalCount={totalCount} currentPage={currentPage} limit={limit} />
      <PaymentTable entries={entries} />
      <Pagination totalCount={totalCount} currentPage={currentPage} limit={limit} persistSize={false} />
    </section>
  )
}
