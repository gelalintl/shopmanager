import { formatCfa } from '@/lib/products'

export const TVA_RATE = 0.19

export type DocumentKind = 'ESTIMATION' | 'INVOICE'
export type InvoiceTab = 'all' | 'devis' | 'factures' | 'pending' | 'paid' | 'drafts'

export type DocumentListFilters = {
  startDate?: string
  endDate?: string
  customerId?: string
  searchQuery?: string
  status?: InvoiceTab | string
  kind?: DocumentKind | 'all' | string
}

export type DocumentStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'INVOICED'
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELED'

export type DocumentLineInput = {
  productId?: number
  productPublicId?: string
  designation: string
  unitPrice: number
  quantity: number
  discountRate: number
}

export type InvoiceItem = {
  key: string
  productId: number | null
  designation: string
  unitPrice: number
  quantity: number
  discountRate: number
  query: string
}

export type DocumentLineView = DocumentLineInput & {
  ht: number
}

export type DocumentTotals = {
  linesHt: number
  globalDiscount: number
  ht: number
  vat: number
  ttc: number
}

export const DEFAULT_PRINT_ACCENT = '#1d4ed8'

export type PrintSettings = {
  showUnitPrice: boolean
  showQuantity: boolean
  showLineTotal: boolean
  showRib: boolean
  showLegalMentions: boolean
  showWarranty: boolean
  accentColor: string
  footerText: string
  defaultWarrantyMonths: number
  defaultPaymentTerms: string
  rccm: string
  bankName: string
  bankAccountName: string
}

export const defaultPrintSettings: PrintSettings = {
  showUnitPrice: true,
  showQuantity: true,
  showLineTotal: true,
  showRib: true,
  showLegalMentions: true,
  showWarranty: true,
  accentColor: DEFAULT_PRINT_ACCENT,
  footerText: '',
  defaultWarrantyMonths: 0,
  defaultPaymentTerms: '',
  rccm: '',
  bankName: '',
  bankAccountName: '',
}

export type CatalogCustomer = {
  publicId: string
  name: string
  phone: string | null
  address: string
  postBox: string | null
  email: string | null
  nif: string | null
  kind?: 'CORPORATE' | 'INDIVIDUAL'
}

export type PrintCompany = {
  name: string
  address: string
  postBox: string | null
  phone1: string
  phone2?: string | null
  email: string | null
  nif: string | null
  rccm?: string | null
  rib: string | null
  bankName?: string | null
  bankAccountName?: string | null
  legalMentions: string | null
  slogan: string | null
  logoPath?: string | null
}

export type PrintCustomer = {
  name: string
  phone: string | null
  address: string
  postBox: string | null
  email: string | null
  nif: string | null
}

export type DocumentListItem = {
  publicId: string
  estimationPublicId: string
  invoicePublicId: string | null
  kind: DocumentKind
  code: string
  customerName: string
  status: DocumentStatus
  totalTtc: number
  paidAmount: number
  remaining: number
  createdAt: string
  dueDate: string | null
}

export function lineHt(unitPrice: number, quantity: number, discountRate: number) {
  const gross = unitPrice * quantity
  const rate = Number.isFinite(discountRate) ? Math.min(Math.max(discountRate, 0), 100) : 0
  return Math.round(gross * (1 - rate / 100))
}

export function computeTotals(
  lines: Array<{ unitPrice: number; quantity: number; discountRate: number }>,
  hasTva: boolean,
  globalDiscountRate = 0,
): DocumentTotals {
  const linesHt = lines.reduce(
    (sum, line) => sum + lineHt(line.unitPrice, line.quantity, line.discountRate),
    0,
  )
  const globalRate = Number.isFinite(globalDiscountRate)
    ? Math.min(Math.max(globalDiscountRate, 0), 100)
    : 0
  const globalDiscount = Math.round(linesHt * (globalRate / 100))
  const ht = linesHt - globalDiscount
  const vat = hasTva ? Math.round(ht * TVA_RATE) : 0
  const ttc = ht + vat
  return { linesHt, globalDiscount, ht, vat, ttc }
}

export function toInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1)
}

export function addDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

export function formatFrDate(date: Date | string) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date) && !date.includes('T')) {
    return parseLocalDate(date.slice(0, 10)).toLocaleDateString('fr-FR')
  }
  const value = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(value.getTime())) return '—'
  return value.toLocaleDateString('fr-FR')
}

export function formatDocumentCode(type: DocumentKind, fiscalYear: number, value: number) {
  const prefix = type === 'ESTIMATION' ? 'DEV' : 'FAC'
  return `${prefix}-${fiscalYear}-${String(value).padStart(4, '0')}`
}

export function normalizeEstimationStatus(status: string): DocumentStatus {
  if (status === 'ON_GOING') return 'DRAFT'
  if (status === 'VALIDATED') return 'INVOICED'
  if (
    status === 'DRAFT' ||
    status === 'SENT' ||
    status === 'ACCEPTED' ||
    status === 'REJECTED' ||
    status === 'INVOICED' ||
    status === 'CANCELED'
  ) {
    return status
  }
  return 'DRAFT'
}

export function resolveInvoiceStatus(
  status: string,
  remaining: number,
  dueDate: Date | string | null,
): DocumentStatus {
  if (status === 'CANCELED') return 'CANCELED'
  if (status === 'PAID' || remaining <= 0) return 'PAID'
  if (dueDate) {
    const due = new Date(dueDate)
    if (!Number.isNaN(due.getTime()) && due.getTime() < Date.now() && remaining > 0) {
      return 'OVERDUE'
    }
  }
  if (status === 'PARTIALLY_PAID' || (remaining > 0 && status === 'UNPAID' && remaining !== undefined)) {
    if (status === 'PARTIALLY_PAID') return 'PARTIALLY_PAID'
  }
  if (status === 'OVERDUE') return 'OVERDUE'
  return remaining > 0 && status === 'PARTIALLY_PAID' ? 'PARTIALLY_PAID' : 'UNPAID'
}

export const statusLabels: Record<DocumentStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  ACCEPTED: 'Accepté',
  REJECTED: 'Refusé',
  INVOICED: 'Facturé',
  UNPAID: 'Impayée',
  PARTIALLY_PAID: 'Acompte',
  PAID: 'Payée',
  OVERDUE: 'En retard',
  CANCELED: 'Annulé',
}

export const statusClass: Record<DocumentStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SENT: 'bg-soft-cobalt text-cobalt',
  ACCEPTED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
  INVOICED: 'bg-indigo-50 text-indigo-700',
  UNPAID: 'bg-amber-50 text-amber-700',
  PARTIALLY_PAID: 'bg-orange-50 text-orange-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  OVERDUE: 'bg-red-50 text-red-700',
  CANCELED: 'bg-slate-100 text-slate-500',
}

export { formatCfa }

function under20(n: number): string {
  const words = [
    'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
    'dix-sept', 'dix-huit', 'dix-neuf',
  ]
  return words[n] ?? String(n)
}

function tens(n: number): string {
  if (n < 20) return under20(n)
  const tensWords = [
    '', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt',
  ]
  const t = Math.floor(n / 10)
  const u = n % 10
  if (t === 7 || t === 9) {
    const base = t === 7 ? 'soixante' : 'quatre-vingt'
    return `${base}-${under20(10 + u)}`.replace(/-zéro$/, '')
  }
  if (u === 0) return tensWords[t] + (t === 8 ? 's' : '')
  if (u === 1 && t !== 8) return `${tensWords[t]}-et-un`
  return `${tensWords[t]}-${under20(u)}`
}

function chunkToWords(n: number): string {
  if (n === 0) return ''
  if (n < 100) return tens(n)
  const h = Math.floor(n / 100)
  const rest = n % 100
  const hundred = h === 1 ? 'cent' : `${under20(h)} cent${rest === 0 && h > 1 ? 's' : ''}`
  return rest ? `${hundred} ${tens(rest)}` : hundred
}

export function amountToLetters(amount: number) {
  const n = Math.round(Math.abs(amount))
  if (n === 0) return 'Zéro francs CFA'
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  const parts: string[] = []
  if (millions) {
    parts.push(millions === 1 ? 'un million' : `${chunkToWords(millions)} millions`)
  }
  if (thousands) {
    parts.push(thousands === 1 ? 'mille' : `${chunkToWords(thousands)} mille`)
  }
  if (rest) parts.push(chunkToWords(rest))
  const text = parts.join(' ').replace(/\s+/g, ' ').trim()
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} francs CFA`
}

function parseAccent(value: unknown) {
  const raw = String(value ?? '').trim()
  return /^#([0-9a-fA-F]{6})$/.test(raw) ? raw.toLowerCase() : DEFAULT_PRINT_ACCENT
}

export function parsePrintSettings(value: unknown): PrintSettings {
  if (!value || typeof value !== 'object') return defaultPrintSettings
  const raw = value as Record<string, unknown>
  const warranty = Number(raw.defaultWarrantyMonths)
  return {
    showUnitPrice: raw.showUnitPrice !== false,
    showQuantity: raw.showQuantity !== false,
    showLineTotal: raw.showLineTotal !== false,
    showRib: raw.showRib !== false,
    showLegalMentions: raw.showLegalMentions !== false,
    showWarranty: raw.showWarranty !== false,
    accentColor: parseAccent(raw.accentColor),
    footerText: String(raw.footerText ?? '').trim(),
    defaultWarrantyMonths: Number.isFinite(warranty) ? Math.min(Math.max(Math.round(warranty), 0), 12) : 0,
    defaultPaymentTerms: String(raw.defaultPaymentTerms ?? '').trim(),
    rccm: String(raw.rccm ?? '').trim(),
    bankName: String(raw.bankName ?? '').trim(),
    bankAccountName: String(raw.bankAccountName ?? '').trim(),
  }
}

export function printAccentVars(accent = DEFAULT_PRINT_ACCENT) {
  const color = parseAccent(accent)
  return {
    '--print-accent': color,
    '--print-accent-soft': `color-mix(in srgb, ${color} 14%, white)`,
  } as Record<string, string>
}
