'use server'

import { revalidatePath } from 'next/cache'
import { CustomerKind, EstimationStatus, InvoiceStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/tenant'
import { authorizeMutation, assertSameCompany, type AdminProof } from '@/lib/rbac'
import { MANAGER_ROLES } from '@/lib/auth'
import {
  digitsOnly,
  toCatalogCustomer,
  toFormKind,
  toPrismaKind,
  type CustomerDetails,
  type CustomerInput,
  type CustomerListItem,
  type CustomerTypeFilter,
} from '@/lib/customers'
import {
  invoiceSettlement,
  normalizeEstimationStatus,
  resolveInvoiceStatus,
  type CatalogCustomer,
  type DocumentListItem,
} from '@/lib/invoices'
import { paginationMeta, parseLimit, parsePage, type Paginated } from '@/lib/pagination'
import {
  CUSTOMER_SORTS,
  parseSortDir,
  parseSortKey,
} from '@/lib/table-sort'

const PATH = '/dashboard/customers'

type ActionResult =
  | { ok: true; publicId?: string; customer?: CatalogCustomer }
  | { ok: false; error: string }

function revalidateCustomerPaths() {
  revalidatePath(PATH)
  revalidatePath('/dashboard/invoices')
  revalidatePath('/dashboard/invoices/new')
}

function parsePayload(data: CustomerInput): { ok: true; payload: ParsedCustomer } | { ok: false; error: string } {
  const name = String(data.name ?? '').trim()
  if (!name) {
    return { ok: false, error: 'Le nom du client est obligatoire.' }
  }

  const address = String(data.address ?? '').trim() || null
  const phone = digitsOnly(String(data.phone ?? '')) || null

  const email = String(data.email ?? '').trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'L’email n’est pas valide.' }
  }

  const kind = toPrismaKind(String(data.kind ?? ''))
  const nif = kind === 'CORPORATE' ? String(data.nif ?? '').trim() || null : null
  const postBox = String(data.postBox ?? '').trim() || null

  return {
    ok: true,
    payload: {
      kind: kind === 'CORPORATE' ? CustomerKind.CORPORATE : CustomerKind.INDIVIDUAL,
      name,
      address,
      phone,
      email: email || null,
      nif,
      postBox,
    },
  }
}

type ParsedCustomer = {
  kind: CustomerKind
  name: string
  address: string | null
  phone: string | null
  email: string | null
  nif: string | null
  postBox: string | null
}

function mapListItem(row: {
  publicId: string
  kind: string
  name: string
  nif: string | null
  phone: string | null
  email: string | null
  address: string | null
  postBox: string | null
  invoices: Array<{
    estimation: { totalAmount: bigint }
    collections: Array<{ amount: bigint }>
    creditNotes: Array<{ amount: bigint }>
  }>
}): CustomerListItem {
  const billed = row.invoices.reduce((sum, invoice) => sum + Number(invoice.estimation.totalAmount), 0)
  const collected = row.invoices.reduce((sum, invoice) => {
    const payments = invoice.collections.reduce((inner, col) => inner + Number(col.amount), 0)
    const credits = invoice.creditNotes.reduce((inner, note) => inner + Number(note.amount), 0)
    return sum + invoiceSettlement(Number(invoice.estimation.totalAmount), payments, credits).netPaid
  }, 0)

  return {
    publicId: row.publicId,
    kind: toFormKind(row.kind),
    name: row.name,
    nif: row.nif,
    phone: row.phone,
    email: row.email,
    address: row.address,
    postBox: row.postBox,
    billed,
    collected,
    remaining: Math.max(billed - collected, 0),
  }
}

async function findOwnedCustomer(companyId: number, id: string) {
  return prisma.customer.findFirst({
    where: { companyId, publicId: id, isDeleted: false },
  })
}

export async function getCustomers(
  page = 1,
  limit = 15,
  filters: { q?: string; type?: CustomerTypeFilter; sort?: string; dir?: string } = {},
): Promise<Paginated<CustomerListItem> & { customerCount: number; companies: number; individuals: number; billed: number; remaining: number }> {
  const empty = {
    data: [] as CustomerListItem[],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    customerCount: 0,
    companies: 0,
    individuals: 0,
    billed: 0,
    remaining: 0,
  }
  const ctx = await getTenantContext()
  if (!ctx.ok) return empty

  const search = String(filters.q ?? '').trim()
  const type = filters.type && filters.type !== 'all' ? toPrismaKind(filters.type) : undefined
  const sort = parseSortKey(filters.sort, CUSTOMER_SORTS, 'name')
  const dir = parseSortDir(filters.dir, 'asc')
  const listWhere = {
    companyId: ctx.user.companyId,
    isDeleted: false,
    ...(type ? { kind: type } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { nif: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
  const invoiceInclude = {
    invoices: {
      where: { status: { not: InvoiceStatus.CANCELED } },
      select: {
        estimation: { select: { totalAmount: true } },
        collections: { where: { isDeleted: false }, select: { amount: true } },
        creditNotes: { select: { amount: true } },
      },
    },
  } as const

  const [totalCount, kpiRows] = await Promise.all([
    prisma.customer.count({ where: listWhere }),
    prisma.customer.findMany({
      where: { companyId: ctx.user.companyId, isDeleted: false },
      include: invoiceInclude,
    }),
  ])
  const meta = paginationMeta(totalCount, parsePage(page), parseLimit(limit))
  const orderBy =
    sort === 'kind'
      ? { kind: dir }
      : sort === 'nif'
        ? { nif: dir }
        : sort === 'contact'
          ? { phone: dir }
          : { name: dir }
  const paged = await prisma.customer.findMany({
    where: listWhere,
    orderBy,
    include: invoiceInclude,
    skip: meta.skip,
    take: meta.take,
  })

  const kpi = kpiRows.map(mapListItem)
  const billed = kpi.reduce((sum, item) => sum + item.billed, 0)
  const remaining = kpi.reduce((sum, item) => sum + item.remaining, 0)

  return {
    data: paged.map(mapListItem),
    totalCount: meta.totalCount,
    totalPages: meta.totalPages,
    currentPage: meta.currentPage,
    customerCount: kpi.length,
    companies: kpi.filter((item) => item.kind === 'COMPANY').length,
    individuals: kpi.filter((item) => item.kind === 'INDIVIDUAL').length,
    billed,
    remaining,
  }
}

export async function createCustomer(data: CustomerInput): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const parsed = parsePayload(data)
  if (!parsed.ok) return parsed

  try {
    const customer = await prisma.customer.create({
      data: {
        companyId: ctx.user.companyId,
        createdById: ctx.user.id,
        ...parsed.payload,
      },
    })

    revalidateCustomerPaths()
    return {
      ok: true,
      publicId: customer.publicId,
      customer: toCatalogCustomer(customer),
    }
  } catch (error) {
    console.error('Erreur création client:', error)
    return { ok: false, error: 'La création du client a échoué.' }
  }
}

export async function updateCustomer(id: string, data: CustomerInput): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const parsed = parsePayload(data)
  if (!parsed.ok) return parsed

  const existing = await findOwnedCustomer(ctx.user.companyId, id)
  if (!existing) return { ok: false, error: 'Client introuvable.' }

  try {
    const customer = await prisma.customer.update({
      where: { id: existing.id },
      data: parsed.payload,
    })

    revalidateCustomerPaths()
    revalidatePath(`${PATH}/${customer.publicId}`)
    return {
      ok: true,
      publicId: customer.publicId,
      customer: toCatalogCustomer(customer),
    }
  } catch (error) {
    console.error('Erreur modification client:', error)
    return { ok: false, error: 'La modification du client a échoué.' }
  }
}

export async function deleteCustomer(id: string, adminProof?: AdminProof | null): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const existing = await findOwnedCustomer(ctx.user.companyId, id)
  if (!existing || !assertSameCompany(ctx.user.companyId, existing.companyId)) {
    return { ok: false, error: 'Client introuvable.' }
  }

  const authz = await authorizeMutation(MANAGER_ROLES, adminProof, existing.companyId)
  if (!authz.ok) return authz

  try {
    await prisma.customer.update({
      where: { id: existing.id },
      data: { isDeleted: true, deletedAt: new Date() },
    })

    revalidateCustomerPaths()
    return { ok: true, publicId: existing.publicId }
  } catch (error) {
    console.error('Erreur suppression client:', error)
    return { ok: false, error: 'La suppression du client a échoué.' }
  }
}

export async function getCustomerDetails(id: string): Promise<CustomerDetails | null> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return null

  const customer = await prisma.customer.findFirst({
    where: { companyId: ctx.user.companyId, publicId: id, isDeleted: false },
    include: {
      estimations: {
        where: { status: { not: EstimationStatus.CANCELED } },
        include: { invoice: { select: { publicId: true, code: true } } },
        orderBy: { createdAt: 'desc' },
      },
      invoices: {
        where: { status: { not: InvoiceStatus.CANCELED } },
        include: {
          estimation: { select: { publicId: true, totalAmount: true, code: true } },
          collections: { where: { isDeleted: false }, select: { amount: true } },
          creditNotes: { select: { amount: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!customer) return null

  const list = mapListItem(customer)

  const estimationDocs: DocumentListItem[] = customer.estimations.map((item) => {
    const status = normalizeEstimationStatus(item.status)
    return {
      publicId: item.publicId,
      estimationPublicId: item.publicId,
      invoicePublicId: item.invoice?.publicId ?? null,
      kind: 'ESTIMATION',
      code: item.code,
      customerName: customer.name,
      status,
      totalTtc: Number(item.totalAmount),
      paidAmount: 0,
      remaining: Number(item.totalAmount),
      creditNoteCount: 0,
      creditNoteTotal: 0,
      cancelReason: null,
      cancelRequestedAt: null,
      createdAt: item.createdAt.toISOString(),
      dueDate: item.dueDate?.toISOString() ?? null,
    }
  })

  const invoiceDocs: DocumentListItem[] = customer.invoices.map((item) => {
    const collected = item.collections.reduce((sum, col) => sum + Number(col.amount), 0)
    const credited = item.creditNotes.reduce((sum, note) => sum + Number(note.amount), 0)
    const totalTtc = Number(item.estimation.totalAmount)
    const settlement = invoiceSettlement(totalTtc, collected, credited)
    return {
      publicId: item.publicId,
      estimationPublicId: item.estimation.publicId,
      invoicePublicId: item.publicId,
      kind: 'INVOICE',
      code: item.code,
      customerName: customer.name,
      status: resolveInvoiceStatus(item.status, settlement.remaining, item.dueDate),
      totalTtc,
      paidAmount: settlement.netPaid,
      remaining: settlement.remaining,
      creditNoteCount: item.creditNotes.length,
      creditNoteTotal: settlement.credited,
      cancelReason: item.cancelReason,
      cancelRequestedAt: item.cancelRequestedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      dueDate: item.dueDate?.toISOString() ?? null,
    }
  })

  const documents = [...estimationDocs, ...invoiceDocs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return {
    ...list,
    estimationCount: customer.estimations.length,
    invoiceCount: customer.invoices.length,
    documents,
  }
}
