'use server'

import { revalidatePath } from 'next/cache'
import { MovementType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/tenant'
import { authorizeMutation, assertSameCompany, type AdminProof } from '@/lib/rbac'
import { MANAGER_ROLES } from '@/lib/auth'
import { makeProductCode, getStockStatus, type ProductListItem, type StockFilter } from '@/lib/products'
import { paginationMeta, parseLimit, parsePage, type Paginated } from '@/lib/pagination'

const PRODUCTS_PATH = '/dashboard/products'

type ActionResult = { ok: true } | { ok: false; error: string }

function parsePositiveInt(value: unknown, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/\s/g, ''))
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }
  const companyId = ctx.user.companyId

  const designation = String(formData.get('designation') ?? '').trim()
  if (!designation) return { ok: false, error: 'La désignation est requise.' }

  const data = {
    price: String(formData.get('unitPrice') ?? formData.get('price') ?? ''),
    purchasePrice: String(formData.get('purchasePrice') ?? '').trim(),
    initialStock: String(formData.get('initialStock') ?? formData.get('initialQuantity') ?? ''),
    alertThreshold: String(formData.get('alertThreshold') ?? ''),
    code: String(formData.get('code') ?? '').trim(),
  }

  const unitPrice = parseFloat(data.price)
  const purchasePrice = data.purchasePrice ? parseFloat(data.purchasePrice) : null
  const quantity = parseInt(data.initialStock, 10) || 0
  const alertThreshold = parseInt(data.alertThreshold, 10) || 0

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return { ok: false, error: 'Le prix de vente est invalide.' }
  }

  if (purchasePrice !== null && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) {
    return { ok: false, error: "Le prix d'achat est invalide." }
  }

  try {
    const existingCount = await prisma.product.count({
      where: { companyId },
    })

    const code = (data.code || makeProductCode(designation, existingCount)).toUpperCase()

    const duplicate = await prisma.product.findFirst({
      where: { companyId, code },
    })
    if (duplicate) {
      return { ok: false, error: 'Cette référence existe déjà.' }
    }

    const product = await prisma.product.create({
      data: {
        publicId: `prod_${Date.now()}`,
        companyId,
        code,
        designation,
        unitPrice: BigInt(Math.round(unitPrice)),
        purchasePrice: purchasePrice === null ? null : BigInt(Math.round(purchasePrice)),
        alertThreshold,
        createdById: ctx.user.id,
      },
    })

    if (quantity > 0) {
      await prisma.stockMovement.create({
        data: {
          companyId,
          type: MovementType.IN,
          quantity,
          sellingPrice: BigInt(0),
          productId: product.id,
          createdById: ctx.user.id,
        },
      })
    }

    revalidatePath(PRODUCTS_PATH)
    revalidatePath('/dashboard/invoices')
    return { ok: true }
  } catch (error) {
    console.error('Erreur création produit:', error)
    return { ok: false, error: "L'enregistrement du produit a échoué." }
  }
}

export async function updateProduct(input: {
  publicId: string
  designation: string
  code: string
  unitPrice: number
  purchasePrice?: number | null
  alertThreshold?: number
  adminProof?: AdminProof | null
}): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const designation = input.designation.trim()
  const code = input.code.trim().toUpperCase()
  if (!designation) return { ok: false, error: 'La désignation est requise.' }
  if (!code) return { ok: false, error: 'La référence est requise.' }

  const unitPrice = parsePositiveInt(input.unitPrice, -1)
  if (unitPrice < 0) return { ok: false, error: 'Le prix de vente est invalide.' }

  const purchasePrice =
    input.purchasePrice === null || input.purchasePrice === undefined
      ? null
      : parsePositiveInt(input.purchasePrice, -1)

  if (purchasePrice !== null && purchasePrice < 0) {
    return { ok: false, error: "Le prix d'achat est invalide." }
  }

  const product = await prisma.product.findFirst({
    where: {
      publicId: input.publicId,
      companyId: ctx.user.companyId,
      isDeleted: false,
    },
  })

  if (!product) return { ok: false, error: 'Produit introuvable.' }
  if (!assertSameCompany(ctx.user.companyId, product.companyId)) {
    return { ok: false, error: 'Produit introuvable.' }
  }

  if (unitPrice !== Number(product.unitPrice)) {
    const authz = await authorizeMutation(MANAGER_ROLES, input.adminProof, product.companyId)
    if (!authz.ok) return authz
  }

  const duplicate = await prisma.product.findFirst({
    where: {
      companyId: ctx.user.companyId,
      code,
      NOT: { id: product.id },
    },
  })
  if (duplicate) return { ok: false, error: 'Cette référence existe déjà.' }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      designation,
      code,
      unitPrice: BigInt(unitPrice),
      purchasePrice: purchasePrice === null ? null : BigInt(purchasePrice),
      alertThreshold: parsePositiveInt(input.alertThreshold, 0),
    },
  })

  revalidatePath(PRODUCTS_PATH)
  return { ok: true }
}

export async function restockProduct(input: {
  publicId: string
  quantity: number
}): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const quantity = parsePositiveInt(input.quantity, 0)
  if (quantity <= 0) return { ok: false, error: 'La quantité doit être supérieure à 0.' }

  const product = await prisma.product.findFirst({
    where: {
      publicId: input.publicId,
      companyId: ctx.user.companyId,
      isDeleted: false,
    },
  })

  if (!product) return { ok: false, error: 'Produit introuvable.' }
  if (!assertSameCompany(ctx.user.companyId, product.companyId)) {
    return { ok: false, error: 'Produit introuvable.' }
  }

  await prisma.stockMovement.create({
    data: {
      companyId: ctx.user.companyId,
      type: MovementType.IN,
      quantity,
          sellingPrice: BigInt(0),
      productId: product.id,
      createdById: ctx.user.id,
    },
  })

  revalidatePath(PRODUCTS_PATH)
  return { ok: true }
}

export async function deleteProduct(publicId: string, adminProof?: AdminProof | null): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const product = await prisma.product.findFirst({
    where: {
      publicId,
      companyId: ctx.user.companyId,
      isDeleted: false,
    },
  })
  if (!product || !assertSameCompany(ctx.user.companyId, product.companyId)) {
    return { ok: false, error: 'Produit introuvable.' }
  }

  const authz = await authorizeMutation(MANAGER_ROLES, adminProof, product.companyId)
  if (!authz.ok) return authz

  await prisma.product.update({
    where: { id: product.id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  })

  revalidatePath(PRODUCTS_PATH)
  revalidatePath('/dashboard/invoices')
  return { ok: true }
}

export async function getProducts(
  page = 1,
  limit = 15,
  filters: { q?: string; stock?: StockFilter } = {},
): Promise<Paginated<ProductListItem> & { productCount: number; stockValue: number; lowStockAlerts: number }> {
  const empty = {
    data: [] as ProductListItem[],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    productCount: 0,
    stockValue: 0,
    lowStockAlerts: 0,
  }
  const ctx = await getTenantContext()
  if (!ctx.ok) return empty

  const search = String(filters.q ?? '').trim()
  const stock = filters.stock && filters.stock !== 'all' ? filters.stock : 'all'
  const companyWhere = { companyId: ctx.user.companyId, isDeleted: false }
  const listWhere = {
    ...companyWhere,
    ...(search
      ? {
          OR: [
            { designation: { contains: search, mode: 'insensitive' as const } },
            { code: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
  const movementInclude = {
    movements: {
      where: { isDeleted: false },
      select: { type: true, quantity: true },
    },
  } as const

  function toItem(product: {
    publicId: string
    code: string
    designation: string
    unitPrice: bigint
    purchasePrice: bigint | null
    alertThreshold: number
    movements: Array<{ type: MovementType; quantity: number }>
  }): ProductListItem {
    const quantity = product.movements.reduce((stockQty, movement) => {
      return movement.type === MovementType.IN
        ? stockQty + movement.quantity
        : stockQty - movement.quantity
    }, 0)
    return {
      publicId: product.publicId,
      code: product.code,
      designation: product.designation,
      unitPrice: Number(product.unitPrice),
      purchasePrice: product.purchasePrice === null ? null : Number(product.purchasePrice),
      quantity,
      alertThreshold: product.alertThreshold,
    }
  }

  const statsRows = await prisma.product.findMany({
    where: companyWhere,
    include: movementInclude,
  })
  const stats = statsRows.map(toItem)
  const stockValue = stats.reduce((sum, product) => sum + product.quantity * product.unitPrice, 0)
  const lowStockAlerts = stats.filter((product) => product.quantity <= product.alertThreshold).length

  if (stock !== 'all') {
    const rows = await prisma.product.findMany({
      where: listWhere,
      include: movementInclude,
      orderBy: { designation: 'asc' },
    })
    const filtered = rows.map(toItem).filter((item) => getStockStatus(item.quantity, item.alertThreshold) === stock)
    const meta = paginationMeta(filtered.length, parsePage(page), parseLimit(limit))
    return {
      data: filtered.slice(meta.skip, meta.skip + meta.take),
      totalCount: meta.totalCount,
      totalPages: meta.totalPages,
      currentPage: meta.currentPage,
      productCount: stats.length,
      stockValue,
      lowStockAlerts,
    }
  }

  const totalCount = await prisma.product.count({ where: listWhere })
  const meta = paginationMeta(totalCount, parsePage(page), parseLimit(limit))
  const rows = await prisma.product.findMany({
    where: listWhere,
    include: movementInclude,
    orderBy: { designation: 'asc' },
    skip: meta.skip,
    take: meta.take,
  })

  return {
    data: rows.map(toItem),
    totalCount: meta.totalCount,
    totalPages: meta.totalPages,
    currentPage: meta.currentPage,
    productCount: stats.length,
    stockValue,
    lowStockAlerts,
  }
}

export type ProductSelectItem = {
  id: number
  name: string
  code: string
  unitPrice: number
  stock: number
}

export async function getProductsForSelect(): Promise<ProductSelectItem[]> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return []

  const records = await prisma.product.findMany({
    where: {
      companyId: ctx.user.companyId,
      isDeleted: false,
    },
    select: {
      id: true,
      code: true,
      designation: true,
      unitPrice: true,
      movements: {
        where: { isDeleted: false },
        select: { type: true, quantity: true },
      },
    },
    orderBy: { designation: 'asc' },
  })

  return records.map((product) => ({
    id: product.id,
    name: product.designation,
    code: product.code,
    unitPrice: Number(product.unitPrice),
    stock: product.movements.reduce((quantity, movement) => {
      return movement.type === MovementType.IN
        ? quantity + movement.quantity
        : quantity - movement.quantity
    }, 0),
  }))
}
