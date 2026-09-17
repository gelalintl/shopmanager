'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AddProductModal } from '@/components/products/add-product-modal'
import { ProductFilters } from '@/components/products/product-filters'
import { ProductTable } from '@/components/products/product-table'
import { Pagination } from '@/components/ui/pagination'
import type { ProductListItem, StockFilter } from '@/lib/products'

type ProductCatalogProps = {
  products: ProductListItem[]
  totalCount: number
  currentPage: number
  limit: number
  initialQuery?: string
  initialStock?: StockFilter
}

export function ProductCatalog({
  products,
  totalCount,
  currentPage,
  limit,
  initialQuery = '',
  initialStock = 'all',
}: ProductCatalogProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? initialQuery)
  const stock = (searchParams.get('stock') as StockFilter) || initialStock
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ProductListItem | null>(null)

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
          <ProductFilters
            query={query}
            onQueryChange={setQuery}
            status={stock}
            onStatusChange={(value) => replaceParams({ stock: value === 'all' ? '' : value, page: '' })}
          />
        </div>
        <Button
          className="shrink-0"
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
        >
          Ajouter un produit
        </Button>
      </div>

      <ProductTable
        products={products}
        onEdit={(product) => {
          setEditing(product)
          setModalOpen(true)
        }}
      />
      <Pagination totalCount={totalCount} currentPage={currentPage} limit={limit} />

      <AddProductModal
        open={modalOpen}
        product={editing}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
      />
    </section>
  )
}
