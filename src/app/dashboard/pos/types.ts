import type { CatalogCustomer, DocumentTotals, PrintCompany, PrintSettings } from '@/lib/invoices'
import type { PaymentMethod } from '@/lib/payments'

export const WALK_IN_CUSTOMER_NAME = 'Client Comptoir / Passager'

export type PosProduct = {
  id: number
  publicId: string
  code: string
  designation: string
  unitPrice: number
  stock: number
  type: 'MARCHANDISE' | 'PRESTATION'
}

export type CartItem = {
  productId: number
  publicId: string
  code: string
  designation: string
  unitPrice: number
  quantity: number
  stock: number
  type: 'MARCHANDISE' | 'PRESTATION'
}

export type PosLineInput = {
  productId: number
  quantity: number
  unitPrice?: number
  discountRate?: number
}

export type DirectSaleInput = {
  customerPublicId?: string
  lines: PosLineInput[]
  hasTva: boolean
  globalDiscountRate?: number
  paymentMethod?: string
  amountTendered: number
  note?: string
}

export type DirectSaleResult =
  | {
      ok: true
      publicId: string
      invoicePublicId: string
      collectionPublicId: string
      code: string
      totalTtc: number
      amountTendered: number
      change: number
      paymentMethod: PaymentMethod
    }
  | { ok: false; error: string }

export type PosTicketLine = {
  designation: string
  quantity: number
  unitPrice: number
  discountRate: number
  ht: number
}

export type PosTicket = {
  invoicePublicId: string
  estimationPublicId: string
  code: string
  createdAt: string
  customerName: string
  cashierName: string
  paymentMethod: PaymentMethod
  paymentMethodLabel: string
  amountTendered: number
  change: number
  hasTva: boolean
  lines: PosTicketLine[]
  totals: DocumentTotals
  company: PrintCompany
  settings: PrintSettings
}

export type PosBootstrap = {
  walkIn: CatalogCustomer | null
  products: PosProduct[]
  frequent: PosProduct[]
  customers: CatalogCustomer[]
}

export type PosSaleSuccess = {
  publicId: string
  code: string
  totalTtc: number
  change: number
  amountTendered: number
}
