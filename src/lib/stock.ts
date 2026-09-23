import { MovementType, ProductType, type Prisma } from '@prisma/client'

export const MANUAL_INVENTORY_REASON = 'Ajustement manuel d’inventaire'

export function isServiceProduct(type: ProductType | string | null | undefined) {
  return type === ProductType.PRESTATION || type === 'PRESTATION'
}

export function stockFromMovements(
  movements: Array<{ type: MovementType | string; quantity: number }>,
) {
  return movements.reduce((quantity, movement) => {
    if (movement.type === MovementType.IN || movement.type === 'IN') {
      return quantity + movement.quantity
    }
    if (movement.type === MovementType.OUT || movement.type === 'OUT') {
      return quantity - movement.quantity
    }
    return quantity + movement.quantity
  }, 0)
}

export async function consumeStockForSale(
  tx: Prisma.TransactionClient,
  input: {
    companyId: number
    customerId: number
    actorId: number
    items: Array<{
      productId: number
      quantity: number
      unitPrice: bigint | number
      estimationItemId: bigint
    }>
  },
) {
  const productIds = [...new Set(input.items.map((item) => item.productId))]
  if (!productIds.length) return

  const lockSql = `SELECT id FROM "products" WHERE "companyId" = $1 AND id IN (${productIds
    .map((_, index) => `$${index + 2}`)
    .join(', ')}) FOR UPDATE`
  await tx.$queryRawUnsafe(lockSql, input.companyId, ...productIds)

  const products = await tx.product.findMany({
    where: { id: { in: productIds }, companyId: input.companyId, isDeleted: false },
    select: {
      id: true,
      designation: true,
      type: true,
      movements: { where: { isDeleted: false }, select: { type: true, quantity: true } },
    },
  })
  if (products.length !== productIds.length) {
    throw new Error('Un produit du document est introuvable.')
  }

  const byId = new Map(products.map((product) => [product.id, product]))
  const needed = new Map<number, number>()
  for (const item of input.items) {
    const product = byId.get(item.productId)
    if (!product) throw new Error('Produit introuvable.')
    if (isServiceProduct(product.type)) continue
    needed.set(item.productId, (needed.get(item.productId) ?? 0) + item.quantity)
  }

  for (const [productId, quantity] of needed) {
    const product = byId.get(productId)!
    const stock = stockFromMovements(product.movements)
    if (stock < quantity) {
      throw new Error(`Stock insuffisant pour ${product.designation} (disponible : ${stock}).`)
    }
  }

  for (const item of input.items) {
    const product = byId.get(item.productId)
    if (!product || isServiceProduct(product.type) || item.quantity <= 0) continue
    await tx.stockMovement.create({
      data: {
        companyId: input.companyId,
        type: MovementType.OUT,
        quantity: item.quantity,
        sellingPrice: BigInt(item.unitPrice),
        productId: item.productId,
        customerId: input.customerId,
        estimationItemId: item.estimationItemId,
        createdById: input.actorId,
      },
    })
  }
}
