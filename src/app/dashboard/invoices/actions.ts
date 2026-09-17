'use server'

import { revalidatePath } from 'next/cache'
import {
  EstimationStatus,
  InvoiceStatus,
  PaymentMethod,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/tenant'
import { createCustomer } from '@/app/dashboard/customers/actions'
import { recordPayment } from '@/app/dashboard/payments/actions'
import {
  addDays,
  computeTotals,
  formatDocumentCode,
  normalizeEstimationStatus,
  parseLocalDate,
  resolveInvoiceStatus,
  type CatalogCustomer,
  type DocumentKind,
  type DocumentListFilters,
  type DocumentListItem,
  type InvoiceTab,
} from '@/lib/invoices'
import { paginationMeta, parseLimit, parsePage } from '@/lib/pagination'

const PATH = '/dashboard/invoices'
type ActionResult =
  | { ok: true; publicId?: string; customer?: CatalogCustomer }
  | { ok: false; error: string }

/** Workflow statuses (schema) — asserted for IDEs still on the old Prisma enum. */
function estimationStatus(
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'INVOICED' | 'CANCELED',
): EstimationStatus {
  return status as EstimationStatus
}

type DocumentExtras = {
  dueDate: Date | null
  globalDiscountRate: number
  notes: string | null
  issueDate: Date | null
  validityDays: number
}

function documentExtras<T>(row: T): T & DocumentExtras {
  return row as T & DocumentExtras
}

function lineDiscountRate(item: unknown) {
  if (!item || typeof item !== 'object') return 0
  const value = (item as { discountRate?: number }).discountRate
  return Number(value) || 0
}

type LinePayload = {
  productId?: number
  productPublicId?: string
  designation: string
  unitPrice: number
  quantity: number
  discountRate?: number
}

async function nextOfficialCode(
  tx: Prisma.TransactionClient,
  companyId: number,
  fiscalYear: number,
  type: DocumentKind,
) {
  const seq = await tx.documentSequence.upsert({
    where: {
      companyId_fiscalYear_type: { companyId, fiscalYear, type },
    },
    create: { companyId, fiscalYear, type, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  })
  return formatDocumentCode(type, fiscalYear, seq.lastValue)
}

function parseLines(lines: LinePayload[]) {
  return lines
    .map((line) => ({
      productId: line.productId ? Number(line.productId) : undefined,
      productPublicId: line.productPublicId,
      designation: String(line.designation ?? '').trim(),
      unitPrice: Number(line.unitPrice) || 0,
      quantity: parseInt(String(line.quantity), 10) || 0,
      discountRate: Number(line.discountRate) || 0,
    }))
    .filter((line) => line.designation && line.quantity > 0)
}

const TABS: InvoiceTab[] = ['all', 'devis', 'factures', 'pending', 'paid', 'drafts']

function parseTab(value: unknown): InvoiceTab {
  const tab = String(value ?? 'all')
  return TABS.includes(tab as InvoiceTab) ? (tab as InvoiceTab) : 'all'
}

function parseKind(value: unknown, tab: InvoiceTab): DocumentKind | 'all' {
  const kind = String(value ?? '').toUpperCase()
  if (kind === 'ESTIMATION' || kind === 'INVOICE') return kind
  if (tab === 'devis' || tab === 'drafts') return 'ESTIMATION'
  if (tab === 'factures' || tab === 'paid') return 'INVOICE'
  return 'all'
}

function startOfDay(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function endOfDay(value: string) {
  const date = new Date(`${value}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function dateRange(startDate?: string, endDate?: string): Prisma.DateTimeFilter | undefined {
  const gte = startDate ? startOfDay(startDate) : undefined
  const lte = endDate ? endOfDay(endDate) : undefined
  if (!gte && !lte) return undefined
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) }
}

export async function getDocuments(
  filters: DocumentListFilters = {},
  page = 1,
  limit = 15,
): Promise<{
  documents: DocumentListItem[]
  data: DocumentListItem[]
  totalCount: number
  totalPages: number
  currentPage: number
  customers: Array<{ publicId: string; name: string }>
  billed: number
  pendingQuotes: number
  outstanding: number
}> {
  const empty = {
    documents: [],
    data: [] as DocumentListItem[],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    customers: [],
    billed: 0,
    pendingQuotes: 0,
    outstanding: 0,
  }

  const ctx = await getTenantContext()
  if (!ctx.ok) return empty

  const companyId = ctx.user.companyId
  const tab = parseTab(filters.status)
  const kind = parseKind(filters.kind, tab)
  const customerPublicId = String(filters.customerId ?? '').trim()
  const search = String(filters.searchQuery ?? '').trim()
  const createdAt = dateRange(filters.startDate, filters.endDate)
  const includeEstimations = kind !== 'INVOICE'
  const includeInvoices = kind !== 'ESTIMATION'

  const customerFilter = customerPublicId
    ? { customer: { publicId: customerPublicId, isDeleted: false } }
    : {}
  const codeFilter = search
    ? { code: { contains: search, mode: 'insensitive' as const } }
    : {}

  const estimationStatusFilter = (): Prisma.EstimationWhereInput => {
    if (tab === 'drafts') return { status: { in: ['DRAFT', 'ON_GOING'] } }
    if (tab === 'pending') return { status: { in: ['SENT', 'ACCEPTED'] } }
    return { status: { not: 'CANCELED' } }
  }

  const invoiceStatusFilter = (): Prisma.InvoiceWhereInput => {
    if (tab === 'paid') return { status: InvoiceStatus.PAID }
    if (tab === 'pending') {
      return { status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] } }
    }
    return { status: { not: InvoiceStatus.CANCELED } }
  }

  const estimationWhere: Prisma.EstimationWhereInput = {
    companyId,
    invoice: { is: null },
    ...estimationStatusFilter(),
    ...customerFilter,
    ...codeFilter,
    ...(createdAt ? { createdAt } : {}),
  }
  const invoiceWhere: Prisma.InvoiceWhereInput = {
    companyId,
    ...invoiceStatusFilter(),
    ...customerFilter,
    ...codeFilter,
    ...(createdAt ? { createdAt } : {}),
  }

  const [estimationCount, invoiceCount] = await Promise.all([
    includeEstimations ? prisma.estimation.count({ where: estimationWhere }) : Promise.resolve(0),
    includeInvoices ? prisma.invoice.count({ where: invoiceWhere }) : Promise.resolve(0),
  ])
  const mixed = includeEstimations && includeInvoices
  const listTotal = mixed ? estimationCount + invoiceCount : includeEstimations ? estimationCount : invoiceCount
  const listMeta = paginationMeta(listTotal, parsePage(page), parseLimit(limit))
  const skip = mixed ? undefined : listMeta.skip
  const take = mixed ? undefined : listMeta.take

  const [estimationRows, invoiceRows, statInvoices, statEstimations, customers] = await Promise.all([
    includeEstimations
      ? prisma.estimation.findMany({
          where: estimationWhere,
          include: { customer: true, invoice: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        })
      : Promise.resolve([]),
    includeInvoices
      ? prisma.invoice.findMany({
          where: invoiceWhere,
          include: {
            customer: true,
            estimation: true,
            collections: { where: { isDeleted: false } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        })
      : Promise.resolve([]),
    prisma.invoice.findMany({
      where: { companyId, status: { not: InvoiceStatus.CANCELED } },
      include: {
        estimation: { select: { totalAmount: true } },
        collections: { where: { isDeleted: false }, select: { amount: true } },
      },
    }),
    prisma.estimation.findMany({
      where: { companyId, status: { not: 'CANCELED' }, invoice: { is: null } },
      select: { status: true },
    }),
    prisma.customer.findMany({
      where: { companyId, isDeleted: false },
      select: { publicId: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const estimationDocs: DocumentListItem[] = estimationRows.map((item) => {
    const status = normalizeEstimationStatus(item.status)
    return {
      publicId: item.publicId,
      estimationPublicId: item.publicId,
      invoicePublicId: null,
      kind: 'ESTIMATION',
      code: item.code,
      customerName: item.customer.name,
      status,
      totalTtc: Number(item.totalAmount),
      paidAmount: 0,
      remaining: Number(item.totalAmount),
      createdAt: item.createdAt.toISOString(),
      dueDate: item.dueDate?.toISOString() ?? null,
    }
  })

  const invoiceDocs: DocumentListItem[] = invoiceRows.map((item) => {
    const paidAmount = item.collections.reduce((sum, col) => sum + Number(col.amount), 0)
    const totalTtc = Number(item.estimation.totalAmount)
    const remaining = Math.max(totalTtc - paidAmount, 0)
    return {
      publicId: item.publicId,
      estimationPublicId: item.estimation.publicId,
      invoicePublicId: item.publicId,
      kind: 'INVOICE',
      code: item.code,
      customerName: item.customer.name,
      status: resolveInvoiceStatus(item.status, remaining, item.dueDate),
      totalTtc,
      paidAmount,
      remaining,
      createdAt: item.createdAt.toISOString(),
      dueDate: item.dueDate?.toISOString() ?? null,
    }
  })

  const documents = [...invoiceDocs, ...estimationDocs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const data = mixed ? documents.slice(listMeta.skip, listMeta.skip + listMeta.take) : documents

  const billed = statInvoices.reduce((sum, item) => sum + Number(item.estimation.totalAmount), 0)
  const outstanding = statInvoices.reduce((sum, item) => {
    const paid = item.collections.reduce((inner, col) => inner + Number(col.amount), 0)
    return sum + Math.max(Number(item.estimation.totalAmount) - paid, 0)
  }, 0)
  const pendingQuotes = statEstimations.filter((item) => {
    const status = normalizeEstimationStatus(item.status)
    return status === 'DRAFT' || status === 'SENT' || status === 'ACCEPTED'
  }).length

  return {
    documents: data,
    data,
    totalCount: listMeta.totalCount,
    totalPages: listMeta.totalPages,
    currentPage: listMeta.currentPage,
    customers,
    billed,
    pendingQuotes,
    outstanding,
  }
}

export async function getInvoices(
  filters: DocumentListFilters = {},
  page = 1,
  limit = 15,
) {
  return getDocuments(filters, page, limit)
}

export async function createDocument(input: {
  kind: DocumentKind
  official: boolean
  customerPublicId: string
  hasTva: boolean
  warranty?: number
  globalDiscountRate?: number
  notes?: string
  issueDate?: string | null
  validityDays?: number
  dueDate?: string | null
  lines: LinePayload[]
}): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const lines = parseLines(input.lines)
  if (!lines.length) return { ok: false, error: 'Ajoutez au moins une ligne.' }
  if (!input.customerPublicId) return { ok: false, error: 'Sélectionnez un client.' }

  const customer = await prisma.customer.findFirst({
    where: {
      publicId: input.customerPublicId,
      companyId: ctx.user.companyId,
      isDeleted: false,
    },
  })
  if (!customer) return { ok: false, error: 'Client introuvable.' }

  const productIds = lines
    .map((line) => line.productId)
    .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0)
  const productPublicIds = lines.map((line) => line.productPublicId).filter(Boolean) as string[]
  const productFilter: Prisma.ProductWhereInput[] = []
  if (productIds.length) productFilter.push({ id: { in: productIds } })
  if (productPublicIds.length) productFilter.push({ publicId: { in: productPublicIds } })
  if (!productFilter.length) return { ok: false, error: 'Sélectionnez un produit du catalogue pour chaque ligne.' }

  const products = await prisma.product.findMany({
    where: {
      companyId: ctx.user.companyId,
      isDeleted: false,
      OR: productFilter,
    },
  })
  const productById = new Map(products.map((product) => [product.id, product]))
  const productByPublicId = new Map(products.map((product) => [product.publicId, product]))

  const hasTva = Boolean(input.hasTva)
  const globalDiscountRate = Number(input.globalDiscountRate) || 0
  const totals = computeTotals(lines, hasTva, globalDiscountRate)
  const issueDate = input.issueDate ? parseLocalDate(input.issueDate) : new Date()
  const fiscalYear = issueDate.getFullYear()
  const asInvoice = input.kind === 'INVOICE'
  const validityDays = asInvoice
    ? 0
    : Math.min(Math.max(parseInt(String(input.validityDays ?? 30), 10) || 30, 1), 3650)
  const dueDate = asInvoice
    ? input.dueDate
      ? parseLocalDate(input.dueDate)
      : null
    : addDays(issueDate, validityDays)

  try {
    const created = await prisma.$transaction(async (tx) => {
      const estimationCode = input.official
        ? await nextOfficialCode(tx, ctx.user.companyId, fiscalYear, 'ESTIMATION')
        : `DEV-B${Date.now().toString(36).toUpperCase()}`

      const estimation = await tx.estimation.create({
        data: {
          companyId: ctx.user.companyId,
          code: estimationCode,
          fiscalYear,
          hasTva,
          warranty: Math.min(Math.max(parseInt(String(input.warranty ?? 0), 10) || 0, 0), 12),
          status: estimationStatus(
            asInvoice ? 'INVOICED' : input.official ? 'SENT' : 'DRAFT',
          ),
          totalAmount: BigInt(totals.ttc),
          globalDiscountRate,
          notes: input.notes?.trim() || null,
          dueDate,
          issueDate,
          validityDays: asInvoice ? 30 : validityDays,
          customerId: customer.id,
          createdById: ctx.user.id,
        } as Prisma.EstimationUncheckedCreateInput,
      })

      for (const line of lines) {
        const product = line.productId
          ? productById.get(line.productId)
          : line.productPublicId
            ? productByPublicId.get(line.productPublicId)
            : undefined
        if (!product) {
          throw new Error(`Produit introuvable: ${line.designation}`)
        }
        const ht = Math.round(line.unitPrice * line.quantity * (1 - (line.discountRate || 0) / 100))
        await tx.estimationItem.create({
          data: {
            estimationId: estimation.id,
            productId: product.id,
            designation: line.designation,
            unitPrice: BigInt(Math.round(line.unitPrice)),
            quantity: line.quantity,
            discountRate: line.discountRate || 0,
            totalPrice: BigInt(ht),
          } as Prisma.EstimationItemUncheckedCreateInput,
        })
      }

      let invoicePublicId: string | undefined
      if (asInvoice) {
        const invoiceCode = input.official
          ? await nextOfficialCode(tx, ctx.user.companyId, fiscalYear, 'INVOICE')
          : `FAC-B${Date.now().toString(36).toUpperCase()}`
        const invoice = await tx.invoice.create({
          data: {
            companyId: ctx.user.companyId,
            code: invoiceCode,
            fiscalYear,
            status: InvoiceStatus.UNPAID,
            dueDate,
            estimationId: estimation.id,
            customerId: customer.id,
            createdById: ctx.user.id,
          } as Prisma.InvoiceUncheckedCreateInput,
        })
        invoicePublicId = invoice.publicId
      }

      return { estimationPublicId: estimation.publicId, invoicePublicId }
    })

    revalidatePath(PATH)
    return { ok: true, publicId: created.invoicePublicId ?? created.estimationPublicId }
  } catch (error) {
    console.error('Erreur création document:', error)
    return { ok: false, error: "L'enregistrement du document a échoué." }
  }
}

export async function convertEstimationToInvoice(input: {
  estimationPublicId: string
  depositType?: 'percent' | 'amount' | null
  depositValue?: number
  dueDate?: string | null
}): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const estimation = await prisma.estimation.findFirst({
    where: {
      publicId: input.estimationPublicId,
      companyId: ctx.user.companyId,
    },
    include: { invoice: true },
  })
  if (!estimation) return { ok: false, error: 'Devis introuvable.' }
  if (estimation.invoice) return { ok: false, error: 'Ce devis est déjà facturé.' }
  if (
    estimation.status === estimationStatus('CANCELED') ||
    estimation.status === estimationStatus('REJECTED')
  ) {
    return { ok: false, error: 'Ce devis ne peut pas être converti.' }
  }

  const totalTtc = Number(estimation.totalAmount)
  let deposit = 0
  if (input.depositType === 'percent') {
    deposit = Math.round(totalTtc * ((Number(input.depositValue) || 0) / 100))
  } else if (input.depositType === 'amount') {
    deposit = Math.round(Number(input.depositValue) || 0)
  }
  if (deposit < 0 || deposit > totalTtc) {
    return { ok: false, error: "Le montant d'acompte est invalide." }
  }

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const code = await nextOfficialCode(tx, ctx.user.companyId, estimation.fiscalYear, 'INVOICE')
      const created = await tx.invoice.create({
        data: {
          companyId: ctx.user.companyId,
          code,
          fiscalYear: estimation.fiscalYear,
          status: deposit >= totalTtc ? InvoiceStatus.PAID : deposit > 0 ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.UNPAID,
          dueDate: input.dueDate ? new Date(input.dueDate) : documentExtras(estimation).dueDate,
          estimationId: estimation.id,
          customerId: estimation.customerId,
          createdById: ctx.user.id,
        } as Prisma.InvoiceUncheckedCreateInput,
      })

      await tx.estimation.update({
        where: { id: estimation.id },
        data: { status: estimationStatus('INVOICED') },
      })

      if (deposit > 0) {
        await tx.collection.create({
          data: {
            companyId: ctx.user.companyId,
            amount: BigInt(deposit),
            paymentDate: new Date(),
            paymentMethod: PaymentMethod.CASH,
            note: 'Acompte à la conversion',
            invoiceId: created.id,
            collectorId: ctx.user.id,
          },
        })
      }

      return created
    })

    revalidatePath(PATH)
    revalidatePath(`${PATH}/${estimation.publicId}`)
    return { ok: true, publicId: invoice.publicId }
  } catch (error) {
    console.error('Erreur conversion devis:', error)
    return { ok: false, error: 'La conversion en facture a échoué.' }
  }
}

export { recordPayment }

export async function duplicateDocument(publicId: string): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const estimation = await prisma.estimation.findFirst({
    where: { companyId: ctx.user.companyId, publicId },
    include: { items: true, invoice: true },
  })

  const fromInvoice = estimation
    ? null
    : await prisma.invoice.findFirst({
        where: { companyId: ctx.user.companyId, publicId },
        include: { estimation: { include: { items: true } } },
      })

  const source = estimation ?? fromInvoice?.estimation
  if (!source) return { ok: false, error: 'Document introuvable.' }

  const sourceMeta = documentExtras(source)
  const copyIssueDate = new Date()
  const copyValidity = sourceMeta.validityDays > 0 ? sourceMeta.validityDays : 30

  try {
    const copy = await prisma.estimation.create({
      data: {
        companyId: ctx.user.companyId,
        code: `DEV-B${Date.now().toString(36).toUpperCase()}`,
        fiscalYear: copyIssueDate.getFullYear(),
        hasTva: source.hasTva,
        warranty: source.warranty,
        status: estimationStatus('DRAFT'),
        totalAmount: source.totalAmount,
        globalDiscountRate: sourceMeta.globalDiscountRate,
        notes: sourceMeta.notes,
        issueDate: copyIssueDate,
        validityDays: copyValidity,
        dueDate: addDays(copyIssueDate, copyValidity),
        customerId: source.customerId,
        createdById: ctx.user.id,
        items: {
          create: source.items.map((item) => ({
            productId: item.productId,
            designation: item.designation,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            discountRate: lineDiscountRate(item),
            totalPrice: item.totalPrice,
          })),
        },
      } as Prisma.EstimationUncheckedCreateInput,
    })

    revalidatePath(PATH)
    return { ok: true, publicId: copy.publicId }
  } catch (error) {
    console.error('Erreur duplication document:', error)
    return { ok: false, error: 'La duplication a échoué.' }
  }
}

export async function createQuickCustomer(formData: FormData): Promise<ActionResult> {
  return createCustomer({
    kind: String(formData.get('kind') ?? 'INDIVIDUAL'),
    name: String(formData.get('name') ?? ''),
    address: String(formData.get('address') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    nif: String(formData.get('nif') ?? ''),
    postBox: String(formData.get('postBox') ?? ''),
  })
}

export async function updateEstimationStatus(input: {
  estimationPublicId: string
  status: 'SENT' | 'ACCEPTED' | 'REJECTED'
}): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const estimation = await prisma.estimation.findFirst({
    where: {
      publicId: input.estimationPublicId,
      companyId: ctx.user.companyId,
    },
    include: { invoice: true },
  })
  if (!estimation) return { ok: false, error: 'Devis introuvable.' }
  if (estimation.invoice || estimation.status === estimationStatus('INVOICED')) {
    return { ok: false, error: 'Ce devis est déjà facturé.' }
  }
  if (estimation.status === estimationStatus('CANCELED')) {
    return { ok: false, error: 'Devis annulé.' }
  }

  try {
    await prisma.estimation.update({
      where: { id: estimation.id },
      data: { status: estimationStatus(input.status) } as Prisma.EstimationUncheckedUpdateInput,
    })
    revalidatePath(PATH)
    revalidatePath(`${PATH}/${estimation.publicId}`)
    return { ok: true, publicId: estimation.publicId }
  } catch (error) {
    console.error('Erreur statut devis:', error)
    return { ok: false, error: 'La mise à jour du statut a échoué.' }
  }
}
