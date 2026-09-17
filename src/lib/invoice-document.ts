import { prisma } from '@/lib/prisma'
import {
  computeTotals,
  lineHt,
  normalizeEstimationStatus,
  parsePrintSettings,
  resolveInvoiceStatus,
  type DocumentKind,
  type DocumentStatus,
  type DocumentTotals,
  type PrintCompany,
  type PrintCustomer,
  type PrintSettings,
} from '@/lib/invoices'
import { toPrintCompany } from '@/lib/settings'

const estimationInclude = {
  customer: true,
  company: true,
  items: true,
  invoice: {
    include: {
      collections: {
        where: { isDeleted: false },
        orderBy: { paymentDate: 'asc' as const },
      },
    },
  },
}

export type LoadedInvoiceDocument = {
  kind: DocumentKind
  estimationPublicId: string
  invoicePublicId: string | null
  code: string
  status: DocumentStatus
  customer: PrintCustomer
  company: PrintCompany
  lines: Array<{
    designation: string
    quantity: number
    unitPrice: number
    discountRate: number
    ht: number
  }>
  totals: DocumentTotals
  warranty: number
  notes: string | null
  settings: PrintSettings
  paidAmount: number
  remaining: number
  payments: Array<{
    publicId: string
    amount: number
    paymentDate: string
    note: string | null
    paymentMethod?: string
  }>
  createdAt: string
  issueDate: string
  validityDays: number
  validUntil: string | null
}

function mapDocument(
  estimation: {
    publicId: string
    code: string
    status: string
    hasTva: boolean
    warranty: number
    globalDiscountRate: number
    notes: string | null
    dueDate: Date | null
    createdAt: Date
    issueDate?: Date | null
    validityDays?: number
    customer: PrintCustomer
    company: {
      name: string
      address: string
      postBox: string | null
      phone1: string
      phone2?: string | null
      email: string | null
      nif: string | null
      rib: string | null
      legalMentions: string | null
      slogan: string | null
      logoPath?: string | null
      printSettings: unknown
    }
    items: Array<{
      designation: string
      unitPrice: bigint
      quantity: number
      discountRate: number
      totalPrice: bigint
    }>
    invoice: {
      publicId: string
      code: string
      status: string
      dueDate: Date | null
      createdAt: Date
      collections: Array<{
        publicId: string
        amount: bigint
        paymentDate: Date
        note: string | null
        paymentMethod?: string
      }>
    } | null
  },
): LoadedInvoiceDocument {
  const lines = estimation.items.map((item) => {
    const unitPrice = Number(item.unitPrice)
    return {
      designation: item.designation,
      quantity: item.quantity,
      unitPrice,
      discountRate: item.discountRate,
      ht: Number(item.totalPrice) || lineHt(unitPrice, item.quantity, item.discountRate),
    }
  })
  const totals = computeTotals(lines, estimation.hasTva, estimation.globalDiscountRate)
  const paidAmount = estimation.invoice
    ? estimation.invoice.collections.reduce((sum, col) => sum + Number(col.amount), 0)
    : 0
  const remaining = Math.max(totals.ttc - paidAmount, 0)
  const kind: DocumentKind = estimation.invoice ? 'INVOICE' : 'ESTIMATION'

  return {
    kind,
    estimationPublicId: estimation.publicId,
    invoicePublicId: estimation.invoice?.publicId ?? null,
    code: estimation.invoice?.code ?? estimation.code,
    status: estimation.invoice
      ? resolveInvoiceStatus(estimation.invoice.status, remaining, estimation.invoice.dueDate)
      : normalizeEstimationStatus(estimation.status),
    customer: {
      name: estimation.customer.name,
      phone: estimation.customer.phone,
      address: estimation.customer.address,
      postBox: estimation.customer.postBox,
      email: estimation.customer.email,
      nif: estimation.customer.nif,
    },
    company: toPrintCompany(estimation.company),
    lines,
    totals,
    warranty: estimation.warranty,
    notes: estimation.notes,
    settings: parsePrintSettings(estimation.company.printSettings),
    paidAmount,
    remaining,
    payments:
      estimation.invoice?.collections.map((col) => ({
        publicId: col.publicId,
        amount: Number(col.amount),
        paymentDate: col.paymentDate.toISOString(),
        note: col.note,
        paymentMethod: col.paymentMethod,
      })) ?? [],
    createdAt: (estimation.invoice?.createdAt ?? estimation.createdAt).toISOString(),
    issueDate: (estimation.issueDate ?? estimation.createdAt).toISOString(),
    validityDays: estimation.validityDays && estimation.validityDays > 0 ? estimation.validityDays : 30,
    validUntil: estimation.dueDate?.toISOString() ?? null,
  }
}

export async function loadInvoiceDocument(companyId: number, publicId: string) {
  const estimation = await prisma.estimation.findFirst({
    where: { companyId, publicId },
    include: estimationInclude,
  })
  if (estimation) return mapDocument(estimation)

  const invoice = await prisma.invoice.findFirst({
    where: { companyId, publicId },
    include: {
      estimation: { include: estimationInclude },
    },
  })
  if (!invoice) return null
  return mapDocument(invoice.estimation)
}
