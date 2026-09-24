'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  PAGE_SIZE_STORAGE_KEY,
  pageWindow,
  parseLimit,
  type PageSize,
} from '@/lib/pagination'
import { cn } from '@/lib/cn'

const selectClass =
  'h-9 rounded-lg border border-subtle-border bg-white px-2 text-sm font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

type PaginationProps = {
  totalCount: number
  currentPage: number
  limit: number
  persistSize?: boolean
}

export function Pagination({ totalCount, currentPage, limit, persistSize = true }: PaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pageSize = parseLimit(limit)
  const totalPages = Math.max(1, Math.ceil(Math.max(totalCount, 0) / pageSize))
  const page = Math.min(Math.max(currentPage, 1), totalPages)
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)

  function replaceParams(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  useEffect(() => {
    if (!persistSize || searchParams.has('limit')) return
    try {
      const stored = parseLimit(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY))
      if (stored === DEFAULT_PAGE_SIZE) return
      replaceParams({ limit: String(stored), page: '' })
    } catch {
      // ignore storage errors
    }
    // Intentionally run once on mount to hydrate the stored page size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setLimit(next: PageSize) {
    try {
      window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(next))
    } catch {
      // ignore
    }
    replaceParams({
      limit: next === DEFAULT_PAGE_SIZE ? '' : String(next),
      page: '',
    })
  }

  function setPage(next: number) {
    const clamped = Math.min(Math.max(next, 1), totalPages)
    replaceParams({ page: clamped <= 1 ? '' : String(clamped) })
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-subtle-border bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <label className="flex items-center gap-2 text-sm font-bold text-foreground">
        <select
          className={selectClass}
          value={pageSize}
          aria-label="Éléments par page"
          onChange={(event) => setLimit(parseLimit(event.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="text-foreground-muted font-medium">par page</span>
      </label>

      <p className="text-center text-sm text-foreground-muted">
        Affichage de <span className="font-bold text-foreground">{from}</span> à{' '}
        <span className="font-bold text-foreground">{to}</span> sur{' '}
        <span className="font-bold text-foreground">{totalCount}</span> résultat{totalCount > 1 ? 's' : ''}
      </p>

      <div className="flex flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          aria-label="Page précédente"
          title="Page précédente"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-full border border-subtle-border bg-white text-foreground transition-all duration-200',
            page <= 1
              ? 'cursor-not-allowed opacity-40'
              : 'hover:border-primary hover:text-primary',
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageWindow(page, totalPages).map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`} className="px-1 text-foreground-muted">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => setPage(item)}
              className={cn(
                'inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-bold transition-all duration-200',
                item === page
                  ? 'bg-primary text-white'
                  : 'border border-subtle-border bg-white text-foreground hover:border-primary hover:text-primary',
              )}
              aria-current={item === page ? 'page' : undefined}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Page suivante"
          title="Page suivante"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-full border border-subtle-border bg-white text-foreground transition-all duration-200',
            page >= totalPages
              ? 'cursor-not-allowed opacity-40'
              : 'hover:border-primary hover:text-primary',
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
