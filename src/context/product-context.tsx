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

  useEffect(() => {
    void refreshProducts()
  }, [refreshProducts])

  const value = useMemo(
    () => ({ products, isLoading, refreshProducts }),
    [products, isLoading, refreshProducts],
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
