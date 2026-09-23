'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getProductsForSelect,
  type ProductSelectItem,
} from '@/app/dashboard/products/actions'

export type { ProductSelectItem }

type ProductContextValue = {
  products: ProductSelectItem[]
  isLoading: boolean
  refreshProducts: () => Promise<void>
  upsertProduct: (product: ProductSelectItem) => void
}

const ProductContext = createContext<ProductContextValue | null>(null)

export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<ProductSelectItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refreshProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      const list = await getProductsForSelect()
      setProducts(list)
    } catch (error) {
      console.error('Erreur chargement catalogue:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const upsertProduct = useCallback((product: ProductSelectItem) => {
    setProducts((current) => {
      const index = current.findIndex((item) => item.id === product.id)
      if (index === -1) {
        return [...current, product].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      }
      const next = [...current]
      next[index] = product
      return next
    })
  }, [])

  useEffect(() => {
    void refreshProducts()
  }, [refreshProducts])

  const value = useMemo(
    () => ({ products, isLoading, refreshProducts, upsertProduct }),
    [products, isLoading, refreshProducts, upsertProduct],
  )

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
}

export function useProductContext() {
  const context = useContext(ProductContext)
  if (!context) {
    throw new Error('useProductContext doit être utilisé dans ProductProvider.')
  }
  return context
}
