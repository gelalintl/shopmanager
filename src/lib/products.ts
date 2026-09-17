export type StockFilter = 'all' | 'ok' | 'low' | 'out'
export type StockStatus = 'ok' | 'low' | 'out'

export type ProductListItem = {
  publicId: string
  code: string
  designation: string
  unitPrice: number
  purchasePrice: number | null
  quantity: number
  alertThreshold: number
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
