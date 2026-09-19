import { prisma } from '@/lib/prisma'
import {
  computeTotals,
  invoiceSettlement,
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
import type { CreditNoteHistoryItem } from '@/lib/credit-notes'
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
      creditNotes: {
        include: { createdBy: { select: { name: true, pseudo: true } } },
        orderBy: { createdAt: 'asc' as const },
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
  creditNoteCount: number
  creditNoteTotal: number
  creditNotes: CreditNoteHistoryItem[]
  cancelReason: string | null
  cancelRequestedAt: string | null
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
      cancelReason: string | null
      cancelRequestedAt: Date | null
      collections: Array<{
        publicId: string
        amount: bigint
        paymentDate: Date
        note: string | null
        paymentMethod?: string
      }>
      creditNotes: Array<{
        publicId: string
        code: string
        amount: bigint
        reason: string
        restock: boolean
        createdAt: Date
        createdBy: { name: string; pseudo: string }
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
  const collected = estimation.invoice
    ? estimation.invoice.collections.reduce((sum, col) => sum + Number(col.amount), 0)
    : 0
  const credited = estimation.invoice
    ? estimation.invoice.creditNotes.reduce((sum, note) => sum + Number(note.amount), 0)
    : 0
  const settlement = invoiceSettlement(totals.ttc, collected, credited)
  const kind: DocumentKind = estimation.invoice ? 'INVOICE' : 'ESTIMATION'

  return {
    kind,
    estimationPublicId: estimation.publicId,
    invoicePublicId: estimation.invoice?.publicId ?? null,
    code: estimation.invoice?.code ?? estimation.code,
    status: estimation.invoice
      ? resolveInvoiceStatus(estimation.invoice.status, settlement.remaining, estimation.invoice.dueDate)
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
    paidAmount: settlement.netPaid,
    remaining: settlement.remaining,
    creditNoteCount: estimation.invoice?.creditNotes.length ?? 0,
    creditNoteTotal: settlement.credited,
    creditNotes:
      estimation.invoice?.creditNotes.map((note) => ({
        publicId: note.publicId,
        code: note.code,
        amount: Number(note.amount),
        reason: note.reason,
        restock: note.restock,
        createdAt: note.createdAt.toISOString(),
        cashierName: note.createdBy.name || note.createdBy.pseudo,
      })) ?? [],
    cancelReason: estimation.invoice?.cancelReason ?? null,
    cancelRequestedAt: estimation.invoice?.cancelRequestedAt?.toISOString() ?? null,
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
