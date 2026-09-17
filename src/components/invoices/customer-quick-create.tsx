'use client'

import { CustomerModal } from '@/components/customers/customer-modal'
import type { CatalogCustomer } from '@/lib/invoices'

type CustomerQuickCreateProps = {
  open: boolean
  onClose: () => void
  onCreated: (publicId: string, customer: CatalogCustomer) => void
}

export function CustomerQuickCreate({ open, onClose, onCreated }: CustomerQuickCreateProps) {
  return (
    <CustomerModal
      open={open}
      onClose={onClose}
      onCreated={(customer) => onCreated(customer.publicId, customer)}
    />
  )
}
