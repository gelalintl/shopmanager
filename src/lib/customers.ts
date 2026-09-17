import type { CatalogCustomer, DocumentListItem } from '@/lib/invoices'

export type CustomerKindForm = 'COMPANY' | 'INDIVIDUAL'
export type CustomerTypeFilter = 'all' | CustomerKindForm

export type CustomerInput = {
  kind: CustomerKindForm | 'CORPORATE' | string
  name: string
  nif?: string | null
  phone?: string | null
  email?: string | null
  address: string
  postBox?: string | null
}

export type CustomerListItem = {
  publicId: string
  kind: CustomerKindForm
  name: string
  nif: string | null
  phone: string | null
  email: string | null
  address: string
  postBox: string | null
  billed: number
  collected: number
  remaining: number
}

export type CustomerDetails = CustomerListItem & {
  estimationCount: number
  invoiceCount: number
  documents: DocumentListItem[]
}

export function toPrismaKind(kind: string): 'CORPORATE' | 'INDIVIDUAL' {
  const value = String(kind ?? '').trim().toUpperCase()
  if (value === 'COMPANY' || value === 'CORPORATE') return 'CORPORATE'
  return 'INDIVIDUAL'
}

export function toFormKind(kind: string): CustomerKindForm {
  return kind === 'CORPORATE' || kind === 'COMPANY' ? 'COMPANY' : 'INDIVIDUAL'
}

export function kindLabel(kind: CustomerKindForm) {
  return kind === 'COMPANY' ? 'Entreprise' : 'Particulier'
}

export function toCatalogCustomer(customer: {
  publicId: string
  name: string
  phone: string | null
  address: string
  postBox: string | null
  email: string | null
  nif: string | null
  kind?: string
}): CatalogCustomer {
  return {
    publicId: customer.publicId,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    postBox: customer.postBox,
    email: customer.email,
    nif: customer.nif,
    kind: customer.kind === 'CORPORATE' || customer.kind === 'INDIVIDUAL' ? customer.kind : undefined,
  }
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}
