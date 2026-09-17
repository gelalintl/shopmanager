import { formatCfa, toInputDate } from '@/lib/invoices'
import type { PaymentMethod } from '@/lib/payments'

export type DashboardPeriod = 'month' | 'year'
export type ReportPreset = 'month' | 'quarter' | 'year' | 'custom'
export type ReportTab = 'sales' | 'receivables' | 'products' | 'vat'

const REPORT_PRESETS: ReportPreset[] = ['month', 'quarter', 'year', 'custom']
const REPORT_TABS: ReportTab[] = ['sales', 'receivables', 'products', 'vat']

export function parseReportPreset(value?: string | null): ReportPreset {
  return REPORT_PRESETS.includes(value as ReportPreset) ? (value as ReportPreset) : 'month'
}

export function parseReportTab(value?: string | null): ReportTab {
  return REPORT_TABS.includes(value as ReportTab) ? (value as ReportTab) : 'sales'
}

export type MonthPoint = {
  key: string
  label: string
  billed: number
  collected: number
}

export type MethodShare = {
  method: PaymentMethod
  amount: number
}

export type TopProduct = {
  productId: number
  code: string
  designation: string
  quantity: number
  revenue: number
}

export type OverdueInvoice = {
  invoicePublicId: string
  estimationPublicId: string
  code: string
  customerName: string
  dueDate: string | null
  remaining: number
  totalTtc: number
}

export type ActivityItem = {
  id: string
  kind: 'INVOICE' | 'PAYMENT' | 'ESTIMATION'
  title: string
  detail: string
  href: string
  at: string
  amount: number | null
}

export type DashboardAnalytics = {
  period: DashboardPeriod
  todayLabel: string
  billed: number
  collected: number
  remaining: number
  monthCollected: number
  todayCollected: number
  pendingQuotesCount: number
  pendingQuotesAmount: number
  overdueCount: number
  overdueAmount: number
  history: MonthPoint[]
  methods: MethodShare[]
  topProducts: TopProduct[]
  overdueInvoices: OverdueInvoice[]
  activity: ActivityItem[]
}

export type SalesReport = {
  billed: number
  collected: number
  invoiceCount: number
  estimationCount: number
  conversionRate: number
  discountTotal: number
  history: MonthPoint[]
}

export type ReceivableRow = {
  customerPublicId: string
  customerName: string
  invoiceCount: number
  billed: number
  collected: number
  remaining: number
  overdueAmount: number
  oldestDueDate: string | null
}

export type VatRow = {
  invoicePublicId: string
  estimationPublicId: string
  code: string
  customerName: string
  date: string
  ht: number
  vat: number
  ttc: number
}

export type ProductSaleRow = {
  productId: number
  code: string
  designation: string
  quantity: number
  revenueHt: number
  revenueTtc: number
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function startOfYear(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1)
}

export function startOfQuarter(date = new Date()) {
  const month = Math.floor(date.getMonth() / 3) * 3
  return new Date(date.getFullYear(), month, 1)
}

export function parseIsoDay(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function periodRange(period: DashboardPeriod) {
  const now = new Date()
  return {
    start: period === 'year' ? startOfYear(now) : startOfMonth(now),
    end: endOfDay(now),
  }
}

export function reportRange(preset: ReportPreset, startDate?: string, endDate?: string) {
  const now = new Date()
  if (preset === 'custom') {
    const start = parseIsoDay(startDate) ?? startOfMonth(now)
    const end = parseIsoDay(endDate) ?? now
    return { start: startOfDay(start), end: endOfDay(end) }
  }
  if (preset === 'year') return { start: startOfYear(now), end: endOfDay(now) }
  if (preset === 'quarter') return { start: startOfQuarter(now), end: endOfDay(now) }
  return { start: startOfMonth(now), end: endOfDay(now) }
}

export function monthBuckets(count = 12) {
  const now = new Date()
  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999)
    return {
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: start.toLocaleDateString('fr-FR', { month: 'short' }),
      start,
      end,
    }
  })
}

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function rangeToInputs(start: Date, end: Date) {
  return { startDate: toInputDate(start), endDate: toInputDate(end) }
}

export function formatCompactCfa(amount: number) {
  if (Math.abs(amount) >= 1_000_000) {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(amount / 1_000_000)} M F`
  }
  return formatCfa(amount)
}

export const filterLabelClass = 'block text-xs font-medium text-slate-600 mb-1'
export const filterFieldClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export function lineFinancials(
  items: Array<{ unitPrice: bigint | number; quantity: number; discountRate: number; totalPrice: bigint | number }>,
  globalDiscountRate: number,
  hasTva: boolean,
  tvaRate = 0.19,
) {
  const linesHt = items.reduce((sum, item) => sum + Number(item.totalPrice), 0)
  const lineDiscount = items.reduce((sum, item) => {
    const gross = Number(item.unitPrice) * item.quantity
    return sum + Math.max(gross - Number(item.totalPrice), 0)
  }, 0)
  const globalDiscount = Math.round(linesHt * ((Number(globalDiscountRate) || 0) / 100))
  const ht = linesHt - globalDiscount
  const vat = hasTva ? Math.round(ht * tvaRate) : 0
  return { linesHt, lineDiscount, globalDiscount, discountTotal: lineDiscount + globalDiscount, ht, vat, ttc: ht + vat }
}
