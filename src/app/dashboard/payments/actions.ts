'use server'

import { revalidatePath } from 'next/cache'
import { InvoiceStatus, PaymentMethod as PrismaPaymentMethod } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/tenant'
import {
  invoiceStatusFromPaid,
  parsePaymentMethod,
  receiptNumber,
  type PaymentJournalEntry,
  type PaymentJournalFilters,
  type PaymentMethod,
  type PaymentReceipt,
} from '@/lib/payments'
import { invoiceSettlement, parsePrintSettings } from '@/lib/invoices'
import { paginationMeta, parseLimit, parsePage } from '@/lib/pagination'
import {
  parseSortDir,
  parseSortKey,
  PAYMENT_SORTS,
} from '@/lib/table-sort'
import { authorizeMutation, assertSameCompany, type AdminProof } from '@/lib/rbac'
import { MANAGER_ROLES } from '@/lib/auth'

const PATH = '/dashboard/payments'

type ActionResult =
  | { ok: true; publicId?: string }
  | { ok: false; error: string }

const activeCollections = { isDeleted: false } as const

function revalidatePaymentPaths(estimationPublicId?: string, customerPublicId?: string) {
  revalidatePath(PATH)
  revalidatePath('/dashboard/invoices')
  revalidatePath('/dashboard/customers')
  if (estimationPublicId) revalidatePath(`/dashboard/invoices/${estimationPublicId}`)
  if (customerPublicId) revalidatePath(`/dashboard/customers/${customerPublicId}`)
}

function toPrismaMethod(method: PaymentMethod): PrismaPaymentMethod {
  return method as PrismaPaymentMethod
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfDay(value: string) {
  const date = new Date(`${value}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function startOfDay(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function recordPayment(input: {
  invoicePublicId: string
  amount: number
  paymentDate?: string
  note?: string
  paymentMethod?: string
}): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const amount = Math.round(Number(input.amount) || 0)
  if (amount <= 0) return { ok: false, error: 'Le montant doit être supérieur à 0.' }

  const invoice = await prisma.invoice.findFirst({
    where: {
      publicId: input.invoicePublicId,
      companyId: ctx.user.companyId,
    },
    include: {
      estimation: { select: { publicId: true, totalAmount: true } },
      customer: { select: { publicId: true } },
      collections: { where: activeCollections, select: { amount: true } },
      creditNotes: { select: { amount: true } },
    },
  })
  if (!invoice) return { ok: false, error: 'Facture introuvable.' }
  if (invoice.status === InvoiceStatus.CANCELED) {
    return { ok: false, error: 'Facture annulée.' }
  }
  if (invoice.status === InvoiceStatus.PENDING_CANCELLATION) {
    return { ok: false, error: 'Facture en attente d’annulation. Règlement impossible.' }
  }

  const collected = invoice.collections.reduce((sum, item) => sum + Number(item.amount), 0)
  const credited = invoice.creditNotes.reduce((sum, item) => sum + Number(item.amount), 0)
  const totalTtc = Number(invoice.estimation.totalAmount)
  const remaining = invoiceSettlement(totalTtc, collected, credited).remaining
  if (amount > remaining) {
    return { ok: false, error: `Le reste à payer est de ${remaining} F CFA.` }
  }

  const paymentMethod = parsePaymentMethod(input.paymentMethod)

  try {
    const created = await prisma.$transaction(async (tx) => {
      const collection = await tx.collection.create({
        data: {
          companyId: ctx.user.companyId,
          amount: BigInt(amount),
          paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
          paymentMethod: toPrismaMethod(paymentMethod),
          note: input.note?.trim() || null,
          invoiceId: invoice.id,
          collectorId: ctx.user.id,
        },
      })

      const paid = invoiceSettlement(totalTtc, collected + amount, credited).netPaid
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: invoiceStatusFromPaid(paid, totalTtc) },
      })

      return collection
    })

    revalidatePaymentPaths(invoice.estimation.publicId, invoice.customer.publicId)
    return { ok: true, publicId: created.publicId }
  } catch (error) {
    console.error('Erreur encaissement:', error)
    return { ok: false, error: "L'enregistrement du règlement a échoué." }
  }
}

export async function cancelPayment(
  collectionId: string,
  adminProof?: AdminProof | null,
): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const collection = await prisma.collection.findFirst({
    where: {
      publicId: collectionId,
      companyId: ctx.user.companyId,
      isDeleted: false,
    },
    include: {
      invoice: {
        include: {
          estimation: { select: { publicId: true, totalAmount: true } },
          customer: { select: { publicId: true } },
          creditNotes: { select: { amount: true } },
        },
      },
    },
  })
  if (!collection) return { ok: false, error: 'Règlement introuvable.' }
  if (!assertSameCompany(ctx.user.companyId, collection.companyId)) {
    return { ok: false, error: 'Règlement introuvable.' }
  }
  const authz = await authorizeMutation(MANAGER_ROLES, adminProof, collection.companyId)
  if (!authz.ok) return authz
  if (collection.invoice.status === InvoiceStatus.CANCELED) {
    return { ok: false, error: 'Facture annulée.' }
  }
  if (collection.invoice.status === InvoiceStatus.PENDING_CANCELLATION) {
    return { ok: false, error: 'Facture en attente d’annulation. Règlement impossible à modifier.' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.collection.update({
        where: { id: collection.id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          cancelledById: authz.actorId,
          cancelledAt: new Date(),
          cancelReason: authz.reason,
        },
      })

      const remainingRows = await tx.collection.findMany({
        where: { invoiceId: collection.invoiceId, isDeleted: false },
        select: { amount: true },
      })
      const collected = remainingRows.reduce((sum, row) => sum + Number(row.amount), 0)
      const credited = collection.invoice.creditNotes.reduce((sum, note) => sum + Number(note.amount), 0)
      const totalTtc = Number(collection.invoice.estimation.totalAmount)
      const paid = invoiceSettlement(totalTtc, collected, credited).netPaid

      await tx.invoice.update({
        where: { id: collection.invoiceId },
        data: { status: invoiceStatusFromPaid(paid, totalTtc) },
      })
    })

    revalidatePaymentPaths(collection.invoice.estimation.publicId, collection.invoice.customer.publicId)
    return { ok: true, publicId: collection.publicId }
  } catch (error) {
    console.error('Erreur annulation règlement:', error)
    return { ok: false, error: "L'annulation du règlement a échoué." }
  }
}

export async function getPaymentsJournal(
  filters: PaymentJournalFilters = {},
  page = 1,
  limit = 15,
): Promise<{
  entries: PaymentJournalEntry[]
  data: PaymentJournalEntry[]
  totalCount: number
  totalPages: number
  currentPage: number
  monthTotal: number
  byMethod: Record<PaymentMethod, number>
  outstanding: number
  customers: Array<{ publicId: string; name: string }>
}> {
  const empty = {
    entries: [],
    data: [] as PaymentJournalEntry[],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    monthTotal: 0,
    byMethod: { CASH: 0, BANK_TRANSFER: 0, CHECK: 0, MOBILE_MONEY: 0, CARD: 0 } as Record<PaymentMethod, number>,
    outstanding: 0,
    customers: [],
  }

  const ctx = await getTenantContext()
  if (!ctx.ok) return empty

  const companyId = ctx.user.companyId
  const sort = parseSortKey(filters.sort, PAYMENT_SORTS, 'date')
  const dir = parseSortDir(filters.dir, 'desc')
  const method = filters.paymentMethod && filters.paymentMethod !== 'all'
    ? parsePaymentMethod(filters.paymentMethod)
    : undefined
  const from = filters.from ? startOfDay(filters.from) : undefined
  const to = filters.to ? endOfDay(filters.to) : undefined

  const monthStart = startOfMonth()
  const listWhere = {
    companyId,
    isDeleted: false,
    ...(method ? { paymentMethod: toPrismaMethod(method) } : {}),
    ...(filters.customerPublicId
      ? { invoice: { customer: { publicId: filters.customerPublicId } } }
      : {}),
    ...(from || to
      ? {
          paymentDate: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  }

  const totalCount = await prisma.collection.count({ where: listWhere })
  const meta = paginationMeta(totalCount, parsePage(page), parseLimit(limit))

  const [rows, monthRows, invoices, customers] = await Promise.all([
    prisma.collection.findMany({
      where: listWhere,
      include: {
        collector: { select: { name: true, pseudo: true } },
        invoice: {
          select: {
            publicId: true,
            code: true,
            customer: { select: { publicId: true, name: true } },
            estimation: { select: { publicId: true, totalAmount: true } },
            collections: { where: { isDeleted: false }, select: { amount: true } },
            creditNotes: { select: { id: true, amount: true } },
          },
        },
      },
      orderBy:
        sort === 'invoice'
          ? { invoice: { code: dir } }
          : sort === 'customer'
            ? { invoice: { customer: { name: dir } } }
            : sort === 'method'
              ? { paymentMethod: dir }
              : sort === 'amount'
                ? { amount: dir }
                : sort === 'agent'
                  ? { collector: { name: dir } }
                  : { paymentDate: dir },
      skip: meta.skip,
      take: meta.take,
    }),
    prisma.collection.findMany({
      where: {
        companyId,
        isDeleted: false,
        paymentDate: { gte: monthStart },
      },
      select: { amount: true, paymentMethod: true },
    }),
    prisma.invoice.findMany({
      where: { companyId, status: { not: InvoiceStatus.CANCELED } },
      select: {
        estimation: { select: { totalAmount: true } },
        collections: { where: activeCollections, select: { amount: true } },
        creditNotes: { select: { amount: true } },
      },
    }),
    prisma.customer.findMany({
      where: { companyId, isDeleted: false },
      select: { publicId: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const byMethod: Record<PaymentMethod, number> = {
    CASH: 0,
    BANK_TRANSFER: 0,
    CHECK: 0,
    MOBILE_MONEY: 0,
    CARD: 0,
  }
  let monthTotal = 0
  for (const row of monthRows) {
    const amount = Number(row.amount)
    monthTotal += amount
    byMethod[row.paymentMethod] = (byMethod[row.paymentMethod] ?? 0) + amount
  }

  const outstanding = invoices.reduce((sum, invoice) => {
    const billed = Number(invoice.estimation.totalAmount)
    const collected = invoice.collections.reduce((inner, col) => inner + Number(col.amount), 0)
    const credited = invoice.creditNotes.reduce((inner, note) => inner + Number(note.amount), 0)
    return sum + invoiceSettlement(billed, collected, credited).remaining
  }, 0)

  const entries = rows.map((row) => ({
    publicId: row.publicId,
    amount: Number(row.amount),
    paymentDate: row.paymentDate.toISOString(),
    paymentMethod: row.paymentMethod,
    note: row.note,
    invoicePublicId: row.invoice.publicId,
    invoiceCode: row.invoice.code,
    estimationPublicId: row.invoice.estimation.publicId,
    customerPublicId: row.invoice.customer.publicId,
    customerName: row.invoice.customer.name,
    collectorName: row.collector.name || row.collector.pseudo,
    hasCreditNotes: row.invoice.creditNotes.length > 0,
    creditNoteCount: row.invoice.creditNotes.length,
    creditNoteTotal: row.invoice.creditNotes.reduce((sum, note) => sum + Number(note.amount), 0),
    refundableAmount: invoiceSettlement(
      Number(row.invoice.estimation.totalAmount),
      row.invoice.collections.reduce((sum, col) => sum + Number(col.amount), 0),
      row.invoice.creditNotes.reduce((sum, note) => sum + Number(note.amount), 0),
    ).netPaid,
  }))

  return {
    entries,
    data: entries,
    totalCount: meta.totalCount,
    totalPages: meta.totalPages,
    currentPage: meta.currentPage,
    monthTotal,
    byMethod,
    outstanding,
    customers,
  }
}

export async function getPaymentReceipt(collectionId: string): Promise<PaymentReceipt | null> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return null

  const collection = await prisma.collection.findFirst({
    where: {
      publicId: collectionId,
      companyId: ctx.user.companyId,
      isDeleted: false,
    },
    include: {
      collector: { select: { name: true, pseudo: true } },
      company: {
        select: {
          name: true,
          address: true,
          phone1: true,
          nif: true,
          rib: true,
          legalMentions: true,
          slogan: true,
          logoPath: true,
          printSettings: true,
        },
      },
      invoice: {
        include: {
          customer: { select: { name: true, address: true, phone: true } },
          estimation: { select: { publicId: true, totalAmount: true } },
          collections: {
            where: activeCollections,
            select: { id: true, amount: true, paymentDate: true },
            orderBy: [{ paymentDate: 'asc' }, { id: 'asc' }],
          },
          creditNotes: { select: { amount: true } },
        },
      },
    },
  })
  if (!collection) return null

  let running = 0
  for (const row of collection.invoice.collections) {
    running += Number(row.amount)
    if (row.id === collection.id) break
  }
  const credited = collection.invoice.creditNotes.reduce((sum, note) => sum + Number(note.amount), 0)
  const remainingAfter = invoiceSettlement(
    Number(collection.invoice.estimation.totalAmount),
    running,
    credited,
  ).remaining
  const extras = parsePrintSettings(collection.company.printSettings)

  return {
    publicId: collection.publicId,
    receiptNumber: receiptNumber(collection.publicId),
    amount: Number(collection.amount),
    paymentDate: collection.paymentDate.toISOString(),
    paymentMethod: collection.paymentMethod,
    note: collection.note,
    remainingAfter,
    invoiceCode: collection.invoice.code,
    estimationPublicId: collection.invoice.estimation.publicId,
    customerName: collection.invoice.customer.name,
    customerAddress: collection.invoice.customer.address,
    customerPhone: collection.invoice.customer.phone,
    companyName: collection.company.name,
    companyAddress: collection.company.address,
    companyPhone: collection.company.phone1,
    companyNif: collection.company.nif,
    companyRccm: extras.rccm || null,
    companyRib: collection.company.rib,
    companyBankName: extras.bankName || null,
    companyBankAccountName: extras.bankAccountName || null,
    companyLegalMentions: collection.company.legalMentions,
    companySlogan: collection.company.slogan,
    companyLogoPath: collection.company.logoPath,
    printSettings: collection.company.printSettings,
    collectorName: collection.collector.name || collection.collector.pseudo,
  }
}
