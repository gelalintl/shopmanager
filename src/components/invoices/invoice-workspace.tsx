'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { InvoiceFilters, type InvoiceFilterValues } from '@/components/invoices/invoice-filters'
import { InvoiceTable } from '@/components/invoices/invoice-table'
import { Pagination } from '@/components/ui/pagination'
import { cn } from '@/lib/cn'
import type { DocumentListItem, InvoiceTab } from '@/lib/invoices'

const tabs: { id: InvoiceTab; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'devis', label: 'Devis' },
  { id: 'factures', label: 'Factures' },
  { id: 'pending', label: 'En attente' },
  { id: 'cancellations', label: 'Demandes d’annulation' },
  { id: 'paid', label: 'Payées' },
  { id: 'drafts', label: 'Proformas' },
]

type InvoiceWorkspaceProps = {
  documents: DocumentListItem[]
  customers: Array<{ publicId: string; name: string }>
  totalCount: number
  currentPage: number
  limit: number
  initialTab?: InvoiceTab
  initialFilters?: InvoiceFilterValues
  cancellationCount?: number
}

export function InvoiceWorkspace({
  documents,
  customers,
  totalCount,
  currentPage,
  limit,
  initialTab = 'all',
  initialFilters,
  cancellationCount = 0,
}: InvoiceWorkspaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = (searchParams.get('tab') as InvoiceTab) || initialTab
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get('q') ?? initialFilters?.searchQuery ?? '',
  )

  const filters: InvoiceFilterValues = {
    startDate: searchParams.get('startDate') ?? initialFilters?.startDate ?? '',
    endDate: searchParams.get('endDate') ?? initialFilters?.endDate ?? '',
    customerId: searchParams.get('customerId') ?? initialFilters?.customerId ?? '',
    searchQuery,
  }

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

  useEffect(() => {
    const current = searchParams.get('q') ?? ''
    if (searchQuery === current) return
    const timer = window.setTimeout(() => replaceParams({ q: searchQuery, page: '' }), 300)
    return () => window.clearTimeout(timer)
  }, [replaceParams, searchQuery, searchParams])

  function handleFilters(next: InvoiceFilterValues) {
    setSearchQuery(next.searchQuery)
    if (
      next.startDate !== filters.startDate ||
      next.endDate !== filters.endDate ||
      next.customerId !== filters.customerId
    ) {
      replaceParams({
        startDate: next.startDate,
        endDate: next.endDate,
        customerId: next.customerId,
        page: '',
      })
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => replaceParams({ tab: item.id === 'all' ? '' : item.id, page: '' })}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-bold transition-all duration-200',
                tab === item.id
                  ? item.id === 'cancellations'
                    ? 'border-red-700 bg-red-700 text-white'
                    : 'border-primary bg-primary text-white'
                  : item.id === 'cancellations'
                    ? 'border-red-200 bg-red-50 text-red-800 hover:border-red-400'
                    : 'border-subtle-border bg-white text-foreground hover:border-primary hover:text-primary',
              )}
            >
              {item.label}
              {item.id === 'cancellations' && cancellationCount > 0 ? ` (${cancellationCount})` : ''}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/invoices/new?kind=estimation">
            <Button variant="outline">Nouveau devis / Proforma</Button>
          </Link>
          <Link href="/dashboard/invoices/new?kind=invoice">
            <Button>Nouvelle facture</Button>
          </Link>
        </div>
      </div>

      <InvoiceFilters
        startDate={filters.startDate}
        endDate={filters.endDate}
        customerId={filters.customerId}
        searchQuery={filters.searchQuery}
        customers={customers}
        onChange={handleFilters}
      />

      <Pagination totalCount={totalCount} currentPage={currentPage} limit={limit} />
      <InvoiceTable documents={documents} />
      <Pagination totalCount={totalCount} currentPage={currentPage} limit={limit} persistSize={false} />
    </section>
  )
}
