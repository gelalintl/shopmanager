export type StockFilter = 'all' | 'ok' | 'low' | 'out'
export type StockStatus = 'ok' | 'low' | 'out'
export type ProductKind = 'MARCHANDISE' | 'PRESTATION'

export type ProductListItem = {
  publicId: string
  code: string
  designation: string
  type: ProductKind
  unitPrice: number
  purchasePrice: number | null
  quantity: number
  alertThreshold: number
}

export const productTypeLabels: Record<ProductKind, string> = {
  MARCHANDISE: 'Marchandise',
  PRESTATION: 'Prestation de service',
}

export function parseProductType(value: unknown): ProductKind {
  return String(value ?? '').toUpperCase() === 'PRESTATION' ? 'PRESTATION' : 'MARCHANDISE'
}

export function isServiceProduct(type: ProductKind | string | null | undefined) {
  return type === 'PRESTATION'
}

export function getStockStatus(quantity: number, alertThreshold: number): StockStatus {
  if (quantity <= 0) return 'out'
  if (quantity <= alertThreshold) return 'low'
  return 'ok'
}

export function formatCfa(amount: number) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} F CFA`
}

export function makeProductCode(designation: string, existingCount: number) {
  const letters = designation
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X')

  return `${letters}${String(existingCount + 1).padStart(3, '0')}`
}
