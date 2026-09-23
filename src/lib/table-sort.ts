export type SortDir = 'asc' | 'desc'

export const PRODUCT_SORTS = ['name', 'price', 'stock'] as const
export const CUSTOMER_SORTS = ['kind', 'name', 'nif', 'contact'] as const
export const DOCUMENT_SORTS = ['date', 'code', 'customer', 'status', 'amount', 'remaining'] as const
export const PAYMENT_SORTS = ['date', 'invoice', 'customer', 'method', 'amount', 'agent'] as const

export type ProductSort = (typeof PRODUCT_SORTS)[number]
export type CustomerSort = (typeof CUSTOMER_SORTS)[number]
export type DocumentSort = (typeof DOCUMENT_SORTS)[number]
export type PaymentSort = (typeof PAYMENT_SORTS)[number]

const STATUS_RANK: Record<string, number> = {
  DRAFT: 0,
  PROFORMA: 0,
  QUOTE: 1,
  SENT: 1,
  ACCEPTED: 2,
  REJECTED: 3,
  INVOICED: 4,
  UNPAID: 5,
  PARTIALLY_PAID: 6,
  OVERDUE: 7,
  PENDING_CANCELLATION: 8,
  PAID: 9,
  CANCELED: 10,
}

export function parseSortDir(value?: string | null, fallback: SortDir = 'asc'): SortDir {
  return value === 'desc' || value === 'asc' ? value : fallback
}

export function parseSortKey<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  const key = String(value ?? '')
  return allowed.includes(key as T) ? (key as T) : fallback
}

export function compareText(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? '').localeCompare(b ?? '', 'fr', { numeric: true, sensitivity: 'base' })
}

export function compareNumber(a: number, b: number) {
  return a - b
}

export function compareDate(a: string | Date | null | undefined, b: string | Date | null | undefined) {
  const left = a ? new Date(a).getTime() : 0
  const right = b ? new Date(b).getTime() : 0
  return left - right
}

export function compareStatus(a: string, b: string) {
  return (STATUS_RANK[a] ?? 99) - (STATUS_RANK[b] ?? 99) || compareText(a, b)
}

export function sortBy<T>(
  rows: T[],
  dir: SortDir,
  compare: (left: T, right: T) => number,
): T[] {
  const factor = dir === 'desc' ? -1 : 1
  return [...rows].sort((left, right) => factor * compare(left, right))
}
