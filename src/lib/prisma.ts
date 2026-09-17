import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Client Prisma étendu pour isoler automatiquement les données d'une entreprise
 */
export const getTenantPrisma = (companyId: number) => {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenantModels = ['User', 'Customer', 'Product', 'StockMovement', 'Estimation', 'Invoice', 'Collection']

          if (tenantModels.includes(model)) {
            // S'assurer que args est initialisé
            const queryArgs = (args ?? {}) as Record<string, any>

            if (['findFirst', 'findMany', 'count'].includes(operation)) {
              queryArgs.where = {
                ...(queryArgs.where ?? {}),
                companyId,
                isDeleted: false,
              }
            }

            if (operation === 'create') {
              queryArgs.data = {
                ...(queryArgs.data ?? {}),
                companyId,
              }
            }

            return query(queryArgs as typeof args)
          }

          return query(args)
        },
      },
    },
  })
}