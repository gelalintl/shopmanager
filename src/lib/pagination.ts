export const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 15
export const PAGE_SIZE_STORAGE_KEY = 'table_items_per_page'

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

export type Paginated<T> = {
  data: T[]
  totalCount: number
  totalPages: number
  currentPage: number
}

export function parseLimit(value?: string | number | null): PageSize {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
  return PAGE_SIZE_OPTIONS.includes(n as PageSize) ? (n as PageSize) : DEFAULT_PAGE_SIZE
}

export function parsePage(value?: string | number | null) {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? '1'), 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.floor(n)
}

export function paginationMeta(totalCount: number, page: number, limit: number) {
  const safeLimit = Math.max(limit, 1)
  const totalPages = Math.max(1, Math.ceil(Math.max(totalCount, 0) / safeLimit))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  return {
    totalCount,
    totalPages,
    currentPage,
    skip: (currentPage - 1) * safeLimit,
    take: safeLimit,
  }
}

export function pageWindow(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const wanted = new Set([1, total, current - 1, current, current + 1])
  const sorted = [...wanted].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
  const items: Array<number | 'gap'> = []
  for (const page of sorted) {
    const previous = items[items.length - 1]
    if (typeof previous === 'number' && page - previous > 1) items.push('gap')
    items.push(page)
  }
  return items
}
