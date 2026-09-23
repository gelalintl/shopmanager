'use server'

import { InvoiceStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/tenant'
import { checkRole } from '@/lib/rbac'
import { MANAGER_ROLES } from '@/lib/auth'
import {
  lineFinancials,
  monthBuckets,
  reportRange,
  type ProductSaleRow,
  type ReceivableRow,
  type ReportPreset,
  type SalesReport,
  type VatRow,
} from '@/lib/analytics'
import { loadPrintCompany } from '@/lib/settings'
import { invoiceSettlement } from '@/lib/invoices'

const activeCollections = { isDeleted: false } as const

export async function getSalesReport(startDate?: string, endDate?: string, preset: ReportPreset = 'month'): Promise<SalesReport> {
  const empty: SalesReport = {
    billed: 0,
    collected: 0,
    invoiceCount: 0,
    estimationCount: 0,
    conversionRate: 0,
    discountTotal: 0,
    history: monthBuckets(12).map((bucket) => ({ key: bucket.key, label: bucket.label, billed: 0, collected: 0 })),
  }
  const ctx = await getTenantContext()
  if (!ctx.ok) return empty
  if (!(await checkRole(MANAGER_ROLES))) return empty

  const companyId = ctx.user.companyId
  const { start, end } = reportRange(preset, startDate, endDate)
  const buckets = monthBuckets(12)
  const historyStart = buckets[0]?.start ?? start

  const [invoices, collections, estimations] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        companyId,
        status: { not: InvoiceStatus.CANCELED },
        createdAt: { gte: historyStart, lte: end },
      },
      include: {
        estimation: {
          select: {
            totalAmount: true,
            globalDiscountRate: true,
            hasTva: true,
            items: { select: { unitPrice: true, quantity: true, discountRate: true, totalPrice: true } },
          },
        },
      },
    }),
    prisma.collection.findMany({
      where: { companyId, isDeleted: false, paymentDate: { gte: historyStart, lte: end } },
      select: { amount: true, paymentDate: true },
    }),
    prisma.estimation.count({
      where: {
        companyId,
        status: { not: 'CANCELED' },
        createdAt: { gte: start, lte: end },
      },
    }),
  ])

  const periodInvoices = invoices.filter((item) => item.createdAt >= start && item.createdAt <= end)
  const billed = periodInvoices.reduce((sum, item) => sum + Number(item.estimation.totalAmount), 0)
  const collected = collections
    .filter((item) => item.paymentDate >= start && item.paymentDate <= end)
    .reduce((sum, item) => sum + Number(item.amount), 0)
  const discountTotal = periodInvoices.reduce((sum, item) => {
    return sum + lineFinancials(item.estimation.items, item.estimation.globalDiscountRate, item.estimation.hasTva).discountTotal
  }, 0)

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

  return {
    billed,
    collected,
    invoiceCount: periodInvoices.length,
    estimationCount: estimations,
    conversionRate: estimations > 0 ? periodInvoices.length / estimations : 0,
    discountTotal,
    history,
  }
}

export async function getOutstandingReport(): Promise<ReceivableRow[]> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return []
  if (!(await checkRole(MANAGER_ROLES))) return []

  const now = new Date()
  const invoices = await prisma.invoice.findMany({
    where: { companyId: ctx.user.companyId, status: { not: InvoiceStatus.CANCELED } },
    include: {
      customer: { select: { publicId: true, name: true } },
      estimation: { select: { totalAmount: true } },
      collections: { where: activeCollections, select: { amount: true } },
      creditNotes: { select: { amount: true } },
    },
  })

  const byCustomer = new Map<string, ReceivableRow>()
  for (const invoice of invoices) {
    const billed = Number(invoice.estimation.totalAmount)
    const collectedRaw = invoice.collections.reduce((sum, col) => sum + Number(col.amount), 0)
    const credited = invoice.creditNotes.reduce((sum, note) => sum + Number(note.amount), 0)
    const settled = invoiceSettlement(billed, collectedRaw, credited)
    const remaining = settled.remaining
    const collected = settled.netPaid
    if (remaining <= 0) continue
    const overdue = invoice.dueDate && invoice.dueDate.getTime() < now.getTime() ? remaining : 0
    const current = byCustomer.get(invoice.customer.publicId) ?? {
      customerPublicId: invoice.customer.publicId,
      customerName: invoice.customer.name,
      invoiceCount: 0,
      billed: 0,
      collected: 0,
      remaining: 0,
      overdueAmount: 0,
      oldestDueDate: null as string | null,
    }
    current.invoiceCount += 1
    current.billed += billed
    current.collected += collected
    current.remaining += remaining
    current.overdueAmount += overdue
    if (invoice.dueDate && remaining > 0) {
      const iso = invoice.dueDate.toISOString()
      if (!current.oldestDueDate || iso < current.oldestDueDate) current.oldestDueDate = iso
    }
    byCustomer.set(invoice.customer.publicId, current)
  }

  return [...byCustomer.values()].sort((a, b) => b.remaining - a.remaining)
}

export async function getVatReport(startDate?: string, endDate?: string, preset: ReportPreset = 'month'): Promise<{
  rows: VatRow[]
  ht: number
  vat: number
  ttc: number
}> {
  const empty = { rows: [], ht: 0, vat: 0, ttc: 0 }
  const ctx = await getTenantContext()
  if (!ctx.ok) return empty
  if (!(await checkRole(MANAGER_ROLES))) return empty

  const { start, end } = reportRange(preset, startDate, endDate)
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: ctx.user.companyId,
      status: { not: InvoiceStatus.CANCELED },
      createdAt: { gte: start, lte: end },
    },
    include: {
      customer: { select: { name: true } },
      estimation: {
        select: {
          publicId: true,
          hasTva: true,
          globalDiscountRate: true,
          totalAmount: true,
          items: { select: { unitPrice: true, quantity: true, discountRate: true, totalPrice: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const rows: VatRow[] = invoices.map((invoice) => {
    const finances = lineFinancials(
      invoice.estimation.items,
      invoice.estimation.globalDiscountRate,
      invoice.estimation.hasTva,
    )
    return {
      invoicePublicId: invoice.publicId,
      estimationPublicId: invoice.estimation.publicId,
      code: invoice.code,
      customerName: invoice.customer.name,
      date: invoice.createdAt.toISOString(),
      ht: finances.ht,
      vat: finances.vat,
      ttc: finances.ttc || Number(invoice.estimation.totalAmount),
    }
  })

  return {
    rows,
    ht: rows.reduce((sum, row) => sum + row.ht, 0),
    vat: rows.reduce((sum, row) => sum + row.vat, 0),
    ttc: rows.reduce((sum, row) => sum + row.ttc, 0),
  }
}

export async function getProductSalesReport(startDate?: string, endDate?: string, preset: ReportPreset = 'month'): Promise<ProductSaleRow[]> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return []
  if (!(await checkRole(MANAGER_ROLES))) return []

  const { start, end } = reportRange(preset, startDate, endDate)
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: ctx.user.companyId,
      status: { not: InvoiceStatus.CANCELED },
      createdAt: { gte: start, lte: end },
    },
    include: {
      estimation: {
        select: {
          totalAmount: true,
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
    },
  })

  const map = new Map<number, ProductSaleRow>()
  for (const invoice of invoices) {
    const ttc = Number(invoice.estimation.totalAmount)
    const itemsHt = invoice.estimation.items.reduce((sum, item) => sum + Number(item.totalPrice), 0)
    for (const item of invoice.estimation.items) {
      const current = map.get(item.productId) ?? {
        productId: item.productId,
        code: item.product.code,
        designation: item.product.designation || item.designation,
        quantity: 0,
        revenueHt: 0,
        revenueTtc: 0,
      }
      current.quantity += item.quantity
      current.revenueHt += Number(item.totalPrice)
      current.revenueTtc += itemsHt > 0 ? (Number(item.totalPrice) / itemsHt) * ttc : 0
      map.set(item.productId, current)
    }
  }

  return [...map.values()].sort((a, b) => b.revenueTtc - a.revenueTtc)
}

export async function getReportCompany() {
  const ctx = await getTenantContext()
  if (!ctx.ok) return null
  if (!(await checkRole(MANAGER_ROLES))) return null
  const company = await prisma.company.findFirst({
    where: { id: ctx.user.companyId, isActive: true },
  })
  if (!company) return null
  return loadPrintCompany(company)
}
