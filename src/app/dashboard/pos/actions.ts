'use server'

import { revalidatePath } from 'next/cache'
import {
  CustomerKind,
  EstimationStatus,
  InvoiceStatus,
  PaymentMethod as PrismaPaymentMethod,
  Prisma,
  ProductType,
  MovementType,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/tenant'
import { toCatalogCustomer } from '@/lib/customers'
import {
  computeTotals,
  formatDocumentCode,
  parsePrintSettings,
} from '@/lib/invoices'
import { toPrintCompany } from '@/lib/settings'
import { parsePaymentMethod, paymentMethodLabels } from '@/lib/payments'
import { STAFF_ROLES } from '@/lib/auth'
import { requireRole } from '@/lib/rbac'
import { issueCreditNote, type CreditNoteInput } from '@/lib/credit-notes'
import { consumeStockForSale, isServiceProduct, stockFromMovements } from '@/lib/stock'
import {
  WALK_IN_CUSTOMER_NAME,
  type DirectSaleInput,
  type DirectSaleResult,
  type PosBootstrap,
  type PosProduct,
  type PosTicket,
} from './types'

function toPosProduct(product: {
  id: number
  publicId: string
  code: string
  designation: string
  unitPrice: bigint
  type: ProductType | string
  movements: Array<{ type: MovementType; quantity: number }>
}): PosProduct {
  const type = product.type === 'PRESTATION' ? 'PRESTATION' : 'MARCHANDISE'
  return {
    id: product.id,
    publicId: product.publicId,
    code: product.code,
    designation: product.designation,
    unitPrice: Number(product.unitPrice),
    type,
    stock: isServiceProduct(type) ? 0 : stockFromMovements(product.movements),
  }
}

const productStockSelect = {
  id: true,
  publicId: true,
  code: true,
  designation: true,
  unitPrice: true,
  type: true,
  movements: {
    where: { isDeleted: false },
    select: { type: true, quantity: true },
  },
} as const

async function nextOfficialCode(
  tx: Prisma.TransactionClient,
  companyId: number,
  fiscalYear: number,
  type: 'ESTIMATION' | 'INVOICE',
) {
  const seq = await tx.documentSequence.upsert({
    where: { companyId_fiscalYear_type: { companyId, fiscalYear, type } },
    create: { companyId, fiscalYear, type, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  })
  return formatDocumentCode(type, fiscalYear, seq.lastValue)
}

function encodePosNote(input: { tendered: number; change: number; extra?: string }) {
  const extra = input.extra?.trim()
  return [`POS|tendered=${input.tendered}|change=${input.change}`, extra].filter(Boolean).join(' · ')
}

function parsePosNote(note: string | null, fallbackTendered: number) {
  const source = note ?? ''
  const tenderedMatch = source.match(/tendered=(\d+)/i)
  const changeMatch = source.match(/change=(\d+)/i)
  const tendered = tenderedMatch ? Number(tenderedMatch[1]) : fallbackTendered
  const change = changeMatch ? Number(changeMatch[1]) : Math.max(tendered - fallbackTendered, 0)
  return { tendered, change }
}

async function getOrCreateWalkInCustomer(companyId: number, createdById: number) {
  const existing = await prisma.customer.findFirst({
    where: {
      companyId,
      isDeleted: false,
      name: { equals: WALK_IN_CUSTOMER_NAME, mode: 'insensitive' },
    },
  })
  if (existing) return existing

  return prisma.customer.create({
    data: {
      companyId,
      createdById,
      kind: CustomerKind.INDIVIDUAL,
      name: WALK_IN_CUSTOMER_NAME,
      address: 'Vente comptoir',
      phone: '00000000',
    },
  })
}

export async function getPosBootstrap(): Promise<PosBootstrap> {
  const empty = { walkIn: null, products: [], frequent: [], customers: [] }
  const ctx = await getTenantContext()
  if (!ctx.ok) return empty

  const companyId = ctx.user.companyId
  const walkIn = await getOrCreateWalkInCustomer(companyId, ctx.user.id)

  const [products, sold, customers] = await Promise.all([
    prisma.product.findMany({
      where: { companyId, isDeleted: false },
      select: productStockSelect,
      orderBy: { designation: 'asc' },
    }),
    prisma.estimationItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      where: {
        product: { companyId, isDeleted: false },
        estimation: {
          companyId,
          status: { notIn: [EstimationStatus.CANCELED, EstimationStatus.REJECTED] },
        },
      },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 24,
    }),
    prisma.customer.findMany({
      where: { companyId, isDeleted: false },
      orderBy: { name: 'asc' },
      take: 80,
    }),
  ])

  const catalog = products.map(toPosProduct)
  const byId = new Map(catalog.map((product) => [product.id, product]))
  const frequentIds = sold.map((row) => row.productId)
  const frequent = frequentIds
    .map((id) => byId.get(id))
    .filter((product): product is PosProduct => Boolean(product))

  if (frequent.length < 12) {
    for (const product of catalog.filter((item) => isServiceProduct(item.type) || item.stock > 0)) {
      if (frequent.some((item) => item.id === product.id)) continue
      frequent.push(product)
      if (frequent.length >= 16) break
    }
  }

  return {
    walkIn: toCatalogCustomer(walkIn),
    products: catalog,
    frequent: frequent.slice(0, 16),
    customers: customers.map(toCatalogCustomer),
  }
}

export async function searchPosProducts(query: string): Promise<PosProduct[]> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return []

  const search = query.trim()
  if (!search) return []

  const products = await prisma.product.findMany({
    where: {
      companyId: ctx.user.companyId,
      isDeleted: false,
      OR: [
        { code: { equals: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
      ],
    },
    select: productStockSelect,
    orderBy: { designation: 'asc' },
    take: 12,
  })

  return products.map(toPosProduct)
}

export async function processDirectSale(data: DirectSaleInput): Promise<DirectSaleResult> {
  try {
    await requireRole(STAFF_ROLES)
  } catch {
    return { ok: false, error: 'Non autorisé.' }
  }

  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const lines = (data.lines ?? [])
    .map((line) => ({
      productId: Number(line.productId),
      quantity: Math.floor(Number(line.quantity) || 0),
      unitPrice: Number(line.unitPrice),
      discountRate: Number(line.discountRate) || 0,
    }))
    .filter((line) => line.productId > 0 && line.quantity > 0)

  if (!lines.length) return { ok: false, error: 'Ajoutez au moins un article.' }

  const qtyByProduct = new Map<number, number>()
  for (const line of lines) {
    qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.quantity)
  }

  const hasTva = Boolean(data.hasTva)
  const globalDiscountRate = Number(data.globalDiscountRate) || 0
  const paymentMethod = parsePaymentMethod(data.paymentMethod)
  const amountTendered = Math.round(Number(data.amountTendered) || 0)

  const walkIn = await getOrCreateWalkInCustomer(ctx.user.companyId, ctx.user.id)
  const customerPublicId = String(data.customerPublicId ?? '').trim()
  const customer = customerPublicId
    ? await prisma.customer.findFirst({
        where: {
          publicId: customerPublicId,
          companyId: ctx.user.companyId,
          isDeleted: false,
        },
      })
    : walkIn

  if (!customer || customer.companyId !== ctx.user.companyId) {
    return { ok: false, error: 'Client introuvable.' }
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const productIds = [...qtyByProduct.keys()]
      const lockSql = `SELECT id FROM "products" WHERE "companyId" = $1 AND id IN (${productIds
        .map((_, index) => `$${index + 2}`)
        .join(', ')}) FOR UPDATE`
      await tx.$queryRawUnsafe(lockSql, ctx.user.companyId, ...productIds)

      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          companyId: ctx.user.companyId,
          isDeleted: false,
        },
        select: productStockSelect,
      })
      if (products.length !== productIds.length) {
        throw new Error('Un produit du panier est introuvable.')
      }

      const productById = new Map(products.map((product) => [product.id, toPosProduct(product)]))
      for (const [productId, quantity] of qtyByProduct) {
        const product = productById.get(productId)
        if (!product) throw new Error('Produit introuvable.')
        if (!isServiceProduct(product.type) && product.stock < quantity) {
          throw new Error(`Stock insuffisant pour ${product.designation} (disponible : ${product.stock}).`)
        }
      }

      const pricedLines = lines.map((line) => {
        const product = productById.get(line.productId)!
        const unitPrice = Number.isFinite(line.unitPrice) && line.unitPrice > 0 ? Math.round(line.unitPrice) : product.unitPrice
        return {
          product,
          quantity: line.quantity,
          unitPrice,
          discountRate: line.discountRate,
        }
      })

      const totals = computeTotals(pricedLines, hasTva, globalDiscountRate)
      if (totals.ttc <= 0) throw new Error('Le montant à encaisser est invalide.')
      if (amountTendered < totals.ttc) {
        throw new Error(`Montant encaissé insuffisant (net à payer : ${totals.ttc} F CFA).`)
      }
      const change = amountTendered - totals.ttc

      const now = new Date()
      const fiscalYear = now.getFullYear()
      const estimationCode = await nextOfficialCode(tx, ctx.user.companyId, fiscalYear, 'ESTIMATION')
      const invoiceCode = await nextOfficialCode(tx, ctx.user.companyId, fiscalYear, 'INVOICE')

      const estimation = await tx.estimation.create({
        data: {
          companyId: ctx.user.companyId,
          code: estimationCode,
          fiscalYear,
          hasTva,
          warranty: 0,
          status: EstimationStatus.INVOICED,
          totalAmount: BigInt(totals.ttc),
          globalDiscountRate,
          notes: 'Vente comptoir',
          issueDate: now,
          validityDays: 0,
          customerId: customer.id,
          createdById: ctx.user.id,
        } as Prisma.EstimationUncheckedCreateInput,
      })

      const createdItems: Array<{ id: bigint; productId: number; unitPrice: number; quantity: number }> = []
      for (const line of pricedLines) {
        const ht = Math.round(line.unitPrice * line.quantity * (1 - (line.discountRate || 0) / 100))
        const item = await tx.estimationItem.create({
          data: {
            estimationId: estimation.id,
            productId: line.product.id,
            designation: line.product.designation,
            unitPrice: BigInt(line.unitPrice),
            quantity: line.quantity,
            discountRate: line.discountRate || 0,
            totalPrice: BigInt(ht),
          } as Prisma.EstimationItemUncheckedCreateInput,
        })
        createdItems.push({
          id: item.id,
          productId: line.product.id,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
        })
      }

      const invoice = await tx.invoice.create({
        data: {
          companyId: ctx.user.companyId,
          code: invoiceCode,
          fiscalYear,
          status: InvoiceStatus.PAID,
          dueDate: now,
          estimationId: estimation.id,
          customerId: customer.id,
          createdById: ctx.user.id,
        } as Prisma.InvoiceUncheckedCreateInput,
      })

      const collection = await tx.collection.create({
        data: {
          companyId: ctx.user.companyId,
          amount: BigInt(totals.ttc),
          paymentDate: now,
          paymentMethod: paymentMethod as PrismaPaymentMethod,
          note: encodePosNote({
            tendered: amountTendered,
            change,
            extra: data.note,
          }),
          invoiceId: invoice.id,
          collectorId: ctx.user.id,
        },
      })

      await consumeStockForSale(tx, {
        companyId: ctx.user.companyId,
        customerId: customer.id,
        actorId: ctx.user.id,
        items: createdItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          estimationItemId: item.id,
        })),
      })

      return {
        invoicePublicId: invoice.publicId,
        collectionPublicId: collection.publicId,
        code: invoice.code,
        totalTtc: totals.ttc,
        change,
      }
    })

    revalidatePath('/dashboard/pos')
    revalidatePath('/dashboard/invoices')
    revalidatePath('/dashboard/payments')
    revalidatePath('/dashboard/products')
    revalidatePath('/dashboard/customers')
    revalidatePath('/dashboard')

    return {
      ok: true,
      publicId: sale.invoicePublicId,
      invoicePublicId: sale.invoicePublicId,
      collectionPublicId: sale.collectionPublicId,
      code: sale.code,
      totalTtc: sale.totalTtc,
      amountTendered,
      change: sale.change,
      paymentMethod,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "L'encaissement a échoué."
    console.error('Erreur vente comptoir:', error)
    return { ok: false, error: message }
  }
}

export async function getPosTicket(invoicePublicId: string): Promise<PosTicket | null> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return null

  const invoice = await prisma.invoice.findFirst({
    where: {
      publicId: invoicePublicId,
      companyId: ctx.user.companyId,
    },
    include: {
      createdBy: { select: { name: true, pseudo: true } },
      customer: { select: { name: true } },
      collections: {
        where: { isDeleted: false },
        orderBy: { paymentDate: 'asc' },
      },
      estimation: {
        include: {
          items: true,
          company: true,
        },
      },
    },
  })
  if (!invoice) return null

  const lines = invoice.estimation.items.map((item) => ({
    designation: item.designation,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    discountRate: Number(item.discountRate) || 0,
    ht: Number(item.totalPrice),
  }))
  const totals = computeTotals(lines, invoice.estimation.hasTva, invoice.estimation.globalDiscountRate)
  const payment = invoice.collections[0]
  const paymentMethod = parsePaymentMethod(payment?.paymentMethod)
  const parsed = parsePosNote(payment?.note ?? null, totals.ttc)

  return {
    invoicePublicId: invoice.publicId,
    estimationPublicId: invoice.estimation.publicId,
    code: invoice.code,
    createdAt: invoice.createdAt.toISOString(),
    customerName: invoice.customer.name,
    cashierName: invoice.createdBy.name || invoice.createdBy.pseudo,
    paymentMethod,
    paymentMethodLabel: paymentMethodLabels[paymentMethod],
    amountTendered: parsed.tendered,
    change: parsed.change,
    hasTva: invoice.estimation.hasTva,
    lines,
    totals,
    company: toPrintCompany(invoice.estimation.company),
    settings: parsePrintSettings(invoice.estimation.company.printSettings),
  }
}

export async function createCreditNote(data: CreditNoteInput) {
  const result = await issueCreditNote(data)
  if (result.ok) {
    revalidatePath('/dashboard/pos')
    revalidatePath('/dashboard/invoices')
    revalidatePath('/dashboard/payments')
    revalidatePath('/dashboard/products')
    revalidatePath('/dashboard')
  }
  return result
}
