export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'MOBILE_MONEY'
export type PaymentMethodFilter = 'all' | PaymentMethod

export type PaymentJournalEntry = {
  publicId: string
  amount: number
  paymentDate: string
  paymentMethod: PaymentMethod
  note: string | null
  invoicePublicId: string
  invoiceCode: string
  estimationPublicId: string
  customerPublicId: string
  customerName: string
  collectorName: string
}

export type PaymentReceipt = {
  publicId: string
  receiptNumber: string
  amount: number
  paymentDate: string
  paymentMethod: PaymentMethod
  note: string | null
  remainingAfter: number
  invoiceCode: string
  estimationPublicId: string
  customerName: string
  customerAddress: string
  customerPhone: string | null
  companyName: string
  companyAddress: string
  companyPhone: string
  companyNif: string | null
  companyRccm: string | null
  companyRib: string | null
  companyBankName: string | null
  companyBankAccountName: string | null
  companyLegalMentions: string | null
  companySlogan: string | null
  companyLogoPath: string | null
  printSettings: unknown
  collectorName: string
}

export type PaymentJournalFilters = {
  from?: string
  to?: string
  customerPublicId?: string
  paymentMethod?: PaymentMethodFilter
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  'CASH',
  'BANK_TRANSFER',
  'CHECK',
  'MOBILE_MONEY',
]

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  BANK_TRANSFER: 'Virement',
  CHECK: 'Chèque',
  MOBILE_MONEY: 'Mobile money',
}

export const paymentMethodClass: Record<PaymentMethod, string> = {
  CASH: 'bg-emerald-50 text-emerald-700',
  BANK_TRANSFER: 'bg-soft-cobalt text-cobalt',
  CHECK: 'bg-amber-50 text-amber-700',
  MOBILE_MONEY: 'bg-indigo-50 text-indigo-700',
}

export function parsePaymentMethod(value: unknown): PaymentMethod {
  const raw = String(value ?? '').trim().toUpperCase()
  if (raw === 'BANK_TRANSFER' || raw === 'CHECK' || raw === 'MOBILE_MONEY' || raw === 'CASH') {
    return raw
  }
  return 'CASH'
}

export function receiptNumber(publicId: string) {
  const tail = publicId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()
  return `REC-${tail || '00000000'}`
}

export function invoiceStatusFromPaid(paid: number, totalTtc: number): 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' {
  if (paid <= 0) return 'UNPAID'
  if (paid >= totalTtc) return 'PAID'
  return 'PARTIALLY_PAID'
}
