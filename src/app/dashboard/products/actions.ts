'use server'

import { revalidatePath } from 'next/cache'
import { MovementType, ProductType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/tenant'
import { authorizeMutation, assertSameCompany, type AdminProof } from '@/lib/rbac'
import { MANAGER_ROLES } from '@/lib/auth'
import {
  makeProductCode,
  getStockStatus,
  parseProductType,
  isServiceProduct,
  type ProductKind,
  type ProductListItem,
  type StockFilter,
} from '@/lib/products'
import { MANUAL_INVENTORY_REASON, stockFromMovements } from '@/lib/stock'
import { paginationMeta, parseLimit, parsePage, type Paginated } from '@/lib/pagination'
import {
  compareNumber,
  compareText,
  parseSortDir,
  parseSortKey,
  sortBy,
  PRODUCT_SORTS,
} from '@/lib/table-sort'

const PRODUCTS_PATH = '/dashboard/products'

export type ProductSelectItem = {
  id: number
  publicId: string
  name: string
  code: string
  unitPrice: number
  stock: number
  type: ProductKind
}

type ActionResult =
  | { ok: true; product?: ProductSelectItem }
  | { ok: false; error: string }

function parsePositiveInt(value: unknown, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/\s/g, ''))
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

function parseSignedInt(value: unknown) {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/\s/g, ''))
  if (!Number.isFinite(n)) return null
  return Math.floor(n)
}

function toProductType(type: ProductKind): ProductType {
  return type === 'PRESTATION' ? ProductType.PRESTATION : ProductType.MARCHANDISE
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }
  const companyId = ctx.user.companyId

  const designation = String(formData.get('designation') ?? '').trim()
  if (!designation) return { ok: false, error: 'La désignation est requise.' }

  const type = parseProductType(formData.get('type'))
  const service = isServiceProduct(type)
  const data = {
    price: String(formData.get('unitPrice') ?? formData.get('price') ?? ''),
    purchasePrice: String(formData.get('purchasePrice') ?? '').trim(),
    initialStock: String(formData.get('initialStock') ?? formData.get('initialQuantity') ?? ''),
    alertThreshold: String(formData.get('alertThreshold') ?? ''),
    code: String(formData.get('code') ?? '').trim(),
  }

  const unitPrice = parseFloat(data.price)
  const purchasePrice = data.purchasePrice ? parseFloat(data.purchasePrice) : null
  const quantity = service ? 0 : parseInt(data.initialStock, 10) || 0
  const alertThreshold = service ? 0 : parseInt(data.alertThreshold, 10) || 0

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
        type: toProductType(type),
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
    revalidatePath('/dashboard/pos')
    return {
      ok: true,
      product: {
        id: product.id,
        publicId: product.publicId,
        name: product.designation,
        code: product.code,
        unitPrice: Number(product.unitPrice),
        stock: quantity,
        type,
      },
    }
  } catch (error) {
    console.error('Erreur création produit:', error)
    return { ok: false, error: "L'enregistrement du produit a échoué." }
  }
}

export async function updateProduct(input: {
  publicId: string
  designation: string
  code: string
  type?: string
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

  const type = parseProductType(input.type)
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
      type: toProductType(type),
      unitPrice: BigInt(unitPrice),
      purchasePrice: purchasePrice === null ? null : BigInt(purchasePrice),
      alertThreshold: isServiceProduct(type) ? 0 : parsePositiveInt(input.alertThreshold, 0),
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
  if (isServiceProduct(product.type)) {
    return { ok: false, error: 'Une prestation de service n’a pas de stock.' }
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

export async function adjustStock(input: {
  publicId: string
  quantity: number
}): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const authz = await authorizeMutation(MANAGER_ROLES, null, ctx.user.companyId)
  if (!authz.ok) return authz

  const nextQuantity = parseSignedInt(input.quantity)
  if (nextQuantity === null || nextQuantity < 0) {
    return { ok: false, error: 'La quantité en stock est invalide.' }
  }

  const product = await prisma.product.findFirst({
    where: {
      publicId: input.publicId,
      companyId: ctx.user.companyId,
      isDeleted: false,
    },
    include: {
      movements: { where: { isDeleted: false }, select: { type: true, quantity: true } },
    },
  })

  if (!product || !assertSameCompany(ctx.user.companyId, product.companyId)) {
    return { ok: false, error: 'Produit introuvable.' }
  }
  if (isServiceProduct(product.type)) {
    return { ok: false, error: 'Une prestation de service n’a pas de stock.' }
  }

  const current = stockFromMovements(product.movements)
  const delta = nextQuantity - current
  if (delta === 0) return { ok: true }

  await prisma.stockMovement.create({
    data: {
      companyId: ctx.user.companyId,
      type: MovementType.ADJUSTMENT,
      quantity: delta,
      sellingPrice: BigInt(0),
      reason: MANUAL_INVENTORY_REASON,
      productId: product.id,
      createdById: authz.actorId,
    },
  })

  revalidatePath(PRODUCTS_PATH)
  revalidatePath('/dashboard/invoices')
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
  filters: { q?: string; stock?: StockFilter; sort?: string; dir?: string } = {},
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
  const sort = parseSortKey(filters.sort, PRODUCT_SORTS, 'name')
  const dir = parseSortDir(filters.dir, 'asc')
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
    type: ProductType
    unitPrice: bigint
    purchasePrice: bigint | null
    alertThreshold: number
    movements: Array<{ type: MovementType; quantity: number }>
  }): ProductListItem {
    const type = parseProductType(product.type)
    return {
      publicId: product.publicId,
      code: product.code,
      designation: product.designation,
      type,
      unitPrice: Number(product.unitPrice),
      purchasePrice: product.purchasePrice === null ? null : Number(product.purchasePrice),
      quantity: isServiceProduct(type) ? 0 : stockFromMovements(product.movements),
      alertThreshold: product.alertThreshold,
    }
  }

  function sortItems(items: ProductListItem[]) {
    return sortBy(items, dir, (left, right) => {
      if (sort === 'price') return compareNumber(left.unitPrice, right.unitPrice)
      if (sort === 'stock') return compareNumber(left.quantity, right.quantity)
      return compareText(left.designation, right.designation) || compareText(left.code, right.code)
    })
  }

  const statsRows = await prisma.product.findMany({
    where: companyWhere,
    include: movementInclude,
  })
  const stats = statsRows.map(toItem)
  const stockValue = stats.reduce((sum, product) => {
    if (isServiceProduct(product.type)) return sum
    return sum + product.quantity * product.unitPrice
  }, 0)
  const lowStockAlerts = stats.filter(
    (product) => !isServiceProduct(product.type) && product.quantity <= product.alertThreshold,
  ).length

  if (stock !== 'all') {
    const rows = await prisma.product.findMany({
      where: listWhere,
      include: movementInclude,
      orderBy: { designation: 'asc' },
    })
    const filtered = sortItems(
      rows
        .map(toItem)
        .filter(
          (item) =>
            !isServiceProduct(item.type) && getStockStatus(item.quantity, item.alertThreshold) === stock,
        ),
    )
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

  if (sort === 'stock') {
    const rows = await prisma.product.findMany({
      where: listWhere,
      include: movementInclude,
    })
    const sorted = sortItems(rows.map(toItem))
    const meta = paginationMeta(sorted.length, parsePage(page), parseLimit(limit))
    return {
      data: sorted.slice(meta.skip, meta.skip + meta.take),
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
    orderBy: sort === 'price' ? { unitPrice: dir } : { designation: dir },
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
      publicId: true,
      code: true,
      designation: true,
      type: true,
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
    publicId: product.publicId,
    name: product.designation,
    code: product.code,
    unitPrice: Number(product.unitPrice),
    type: parseProductType(product.type),
    stock: isServiceProduct(product.type) ? 0 : stockFromMovements(product.movements),
  }))
}
