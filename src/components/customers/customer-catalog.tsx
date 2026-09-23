'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CustomerFilters } from '@/components/customers/customer-filters'
import { CustomerModal } from '@/components/customers/customer-modal'
import { CustomerTable } from '@/components/customers/customer-table'
import { Pagination } from '@/components/ui/pagination'
import type { CustomerListItem, CustomerTypeFilter } from '@/lib/customers'

type CustomerCatalogProps = {
  customers: CustomerListItem[]
  totalCount: number
  currentPage: number
  limit: number
  initialQuery?: string
  initialType?: CustomerTypeFilter
}

export function CustomerCatalog({
  customers,
  totalCount,
  currentPage,
  limit,
  initialQuery = '',
  initialType = 'all',
}: CustomerCatalogProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? initialQuery)
  const type = (searchParams.get('type') as CustomerTypeFilter) || initialType
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerListItem | null>(null)

  const replaceParams = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      const next = params.toString()
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  useEffect(() => {
    const current = searchParams.get('q') ?? ''
    if (query === current) return
    const timer = window.setTimeout(() => replaceParams({ q: query, page: '' }), 300)
    return () => window.clearTimeout(timer)
  }, [query, replaceParams, searchParams])

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <CustomerFilters
            query={query}
            onQueryChange={setQuery}
            type={type}
            onTypeChange={(value) => replaceParams({ type: value === 'all' ? '' : value, page: '' })}
          />
        </div>
        <Button
          className="shrink-0"
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
        >
          Nouveau client
        </Button>
      </div>

      <Pagination totalCount={totalCount} currentPage={currentPage} limit={limit} />
      <CustomerTable
        customers={customers}
        onEdit={(item) => {
          setEditing(item)
          setModalOpen(true)
        }}
      />
      <Pagination totalCount={totalCount} currentPage={currentPage} limit={limit} persistSize={false} />

      <CustomerModal
        open={modalOpen}
        customer={editing}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
      />
    </section>
  )
}
