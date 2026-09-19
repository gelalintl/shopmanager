'use server'

import { InvoiceStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/tenant'
import {
  monthBuckets,
  periodRange,
  startOfDay,
  startOfMonth,
  type ActivityItem,
  type DashboardAnalytics,
  type DashboardPeriod,
  type MethodShare,
  type MonthPoint,
  type OverdueInvoice,
  type TopProduct,
} from '@/lib/analytics'
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments'
import { invoiceSettlement } from '@/lib/invoices'

function parsePeriod(value: unknown): DashboardPeriod {
  return value === 'year' ? 'year' : 'month'
}

export async function getDashboardAnalytics(period: DashboardPeriod | string = 'month'): Promise<DashboardAnalytics> {
  const emptyMethods: MethodShare[] = PAYMENT_METHODS.map((method) => ({ method, amount: 0 }))
  const emptyHistory: MonthPoint[] = monthBuckets(12).map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    billed: 0,
    collected: 0,
  }))
  const empty: DashboardAnalytics = {
    period: 'month',
    todayLabel: new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    billed: 0,
    collected: 0,
    remaining: 0,
    monthCollected: 0,
    todayCollected: 0,
    pendingQuotesCount: 0,
    pendingQuotesAmount: 0,
    overdueCount: 0,
    overdueAmount: 0,
    history: emptyHistory,
    methods: emptyMethods,
    topProducts: [],
    overdueInvoices: [],
    activity: [],
  }

  const ctx = await getTenantContext()
  if (!ctx.ok) return empty

  const resolvedPeriod = parsePeriod(period)
  const companyId = ctx.user.companyId
  const now = new Date()
  const { start, end } = periodRange(resolvedPeriod)
  const monthStart = startOfMonth(now)
  const todayStart = startOfDay(now)
  const buckets = monthBuckets(12)
  const historyStart = buckets[0]?.start ?? monthStart

  const [invoices, collections, pendingQuotes, recentEstimations] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId, status: { not: InvoiceStatus.CANCELED } },
      include: {
        customer: { select: { name: true } },
        estimation: {
          select: {
            publicId: true,
            totalAmount: true,
            createdAt: true,
            items: {
              select: {
                productId: true,
                designation: true,
                quantity: true,
                totalPrice: true,
                product: { select: { code: true, designation: true } },
              },
            },
          },
        },
        collections: { where: { isDeleted: false }, select: { amount: true } },
        creditNotes: { select: { amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.collection.findMany({
      where: { companyId, isDeleted: false, paymentDate: { gte: historyStart } },
      include: {
        invoice: { select: { code: true, estimation: { select: { publicId: true } } } },
      },
      orderBy: { paymentDate: 'desc' },
    }),
    prisma.estimation.findMany({
      where: {
        companyId,
        invoice: { is: null },
        status: { in: ['DRAFT', 'SENT', 'ON_GOING'] },
      },
      select: { totalAmount: true },
    }),
    prisma.estimation.findMany({
      where: { companyId, status: { not: 'CANCELED' } },
      select: { publicId: true, code: true, createdAt: true, totalAmount: true, customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ])

  const billedInPeriod = invoices
    .filter((item) => item.createdAt >= start && item.createdAt <= end)
    .reduce((sum, item) => sum + Number(item.estimation.totalAmount), 0)

  const collectedInPeriod = collections
    .filter((item) => item.paymentDate >= start && item.paymentDate <= end)
    .reduce((sum, item) => sum + Number(item.amount), 0)

  const remaining = invoices.reduce((sum, item) => {
    const ttc = Number(item.estimation.totalAmount)
    const paid = item.collections.reduce((inner, col) => inner + Number(col.amount), 0)
    const credited = item.creditNotes.reduce((inner, note) => inner + Number(note.amount), 0)
    return sum + invoiceSettlement(ttc, paid, credited).remaining
  }, 0)

  const monthCollected = collections
    .filter((item) => item.paymentDate >= monthStart)
    .reduce((sum, item) => sum + Number(item.amount), 0)
  const todayCollected = collections
    .filter((item) => item.paymentDate >= todayStart)
    .reduce((sum, item) => sum + Number(item.amount), 0)

  const overdueAll: OverdueInvoice[] = invoices.flatMap((item) => {
    const totalTtc = Number(item.estimation.totalAmount)
    const paid = item.collections.reduce((sum, col) => sum + Number(col.amount), 0)
    const credited = item.creditNotes.reduce((sum, note) => sum + Number(note.amount), 0)
    const remainingAmount = invoiceSettlement(totalTtc, paid, credited).remaining
    const due = item.dueDate
    if (!(remainingAmount > 0 && due !== null && due.getTime() < now.getTime())) return []
    return [{
      invoicePublicId: item.publicId,
      estimationPublicId: item.estimation.publicId,
      code: item.code,
      customerName: item.customer.name,
      dueDate: due.toISOString(),
      remaining: remainingAmount,
      totalTtc,
    }]
  }).sort((a, b) => {
    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : 0
    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : 0
    return aTime - bTime
  })

  const overdueAmount = overdueAll.reduce((sum, item) => sum + item.remaining, 0)
  const overdueInvoices = overdueAll.slice(0, 8)

  const history = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    billed: invoices
      .filter((item) => item.createdAt >= bucket.start && item.createdAt <= bucket.end)
      .reduce((sum, item) => sum + Number(item.estimation.totalAmount), 0),
    collected: collections
      .filter((item) => item.paymentDate >= bucket.start && item.paymentDate <= bucket.end)
      .reduce((sum, item) => sum + Number(item.amount), 0),
  }))

  const methodsMap: Record<PaymentMethod, number> = {
    CASH: 0,
    BANK_TRANSFER: 0,
    CHECK: 0,
    MOBILE_MONEY: 0,
    CARD: 0,
  }
  for (const row of collections) {
    if (row.paymentDate < start || row.paymentDate > end) continue
    methodsMap[row.paymentMethod] = (methodsMap[row.paymentMethod] ?? 0) + Number(row.amount)
  }
  const methods: MethodShare[] = PAYMENT_METHODS.map((method) => ({ method, amount: methodsMap[method] }))

  const productMap = new Map<number, TopProduct>()
  for (const invoice of invoices) {
    if (invoice.createdAt < start || invoice.createdAt > end) continue
    const ttc = Number(invoice.estimation.totalAmount)
    const itemsHt = invoice.estimation.items.reduce((sum, item) => sum + Number(item.totalPrice), 0)
    for (const item of invoice.estimation.items) {
      const current = productMap.get(item.productId) ?? {
        productId: item.productId,
        code: item.product.code,
        designation: item.product.designation || item.designation,
        quantity: 0,
        revenue: 0,
      }
      const share = itemsHt > 0 ? (Number(item.totalPrice) / itemsHt) * ttc : 0
      current.quantity += item.quantity
      current.revenue += share
      productMap.set(item.productId, current)
    }
  }
  const topProducts = [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  const activity: ActivityItem[] = [
    ...invoices.slice(0, 8).map((item) => ({
      id: `inv-${item.publicId}`,
      kind: 'INVOICE' as const,
      title: `Facture ${item.code}`,
      detail: item.customer.name,
      href: `/dashboard/invoices/${item.estimation.publicId}`,
      at: item.createdAt.toISOString(),
      amount: Number(item.estimation.totalAmount),
    })),
    ...collections.slice(0, 8).map((item) => ({
      id: `col-${item.publicId}`,
      kind: 'PAYMENT' as const,
      title: `Règlement ${item.invoice.code}`,
      detail: 'Encaissement',
      href: `/dashboard/payments/${item.publicId}/print`,
      at: item.paymentDate.toISOString(),
      amount: Number(item.amount),
    })),
    ...recentEstimations.slice(0, 8).map((item) => ({
      id: `est-${item.publicId}`,
      kind: 'ESTIMATION' as const,
      title: `Devis ${item.code}`,
      detail: item.customer.name,
      href: `/dashboard/invoices/${item.publicId}`,
      at: item.createdAt.toISOString(),
      amount: Number(item.totalAmount),
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8)

  return {
    period: resolvedPeriod,
    todayLabel: now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    billed: billedInPeriod,
    collected: collectedInPeriod,
    remaining,
    monthCollected,
    todayCollected,
    pendingQuotesCount: pendingQuotes.length,
    pendingQuotesAmount: pendingQuotes.reduce((sum, item) => sum + Number(item.totalAmount), 0),
    overdueCount: overdueAll.length,
    overdueAmount,
    history,
    methods,
    topProducts,
    overdueInvoices,
    activity,
  }
}
