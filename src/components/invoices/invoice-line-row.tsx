'use client'

import { memo } from 'react'
import { controlClass } from '@/components/ui/input'
import { IconTrash } from '@/components/ui/icons'
import { ProductCombobox, type Product } from '@/components/invoices/product-combobox'
import { type InvoiceItem } from '@/lib/invoices'
import { cn } from '@/lib/cn'

type InvoiceLineRowProps = {
  line: InvoiceItem
  onChange: (key: string, patch: Partial<InvoiceItem>) => void
  onSelectProduct: (key: string, product: Product) => void
  onRemove: (key: string) => void
}

export const InvoiceLineRow = memo(function InvoiceLineRow({
  line,
  onChange,
  onSelectProduct,
  onRemove,
}: InvoiceLineRowProps) {
  return (
    <tr className="border-b border-subtle-border/70">
      <td className="min-w-0 py-2 pr-2 align-middle">
        <ProductCombobox
          value={line.query}
          onQueryChange={(query) => onChange(line.key, { query, productId: null, designation: query })}
          onSelect={(product) => onSelectProduct(line.key, product)}
        />
      </td>
      <td className="w-16 py-2 pr-2 align-middle">
        <input
          type="number"
          min={1}
          aria-label="Quantité"
          className={cn(controlClass, 'w-16 px-2 text-base')}
          value={line.quantity}
          onChange={(event) => onChange(line.key, { quantity: Number(event.target.value) || 0 })}
        />
      </td>
      <td className="w-24 py-2 pr-2 align-middle">
        <input
          type="number"
          min={0}
          aria-label="Prix unitaire"
          className={cn(controlClass, 'w-24 px-2 text-base')}
          value={line.unitPrice}
          onChange={(event) => onChange(line.key, { unitPrice: Number(event.target.value) || 0 })}
        />
      </td>
      <td className="w-16 py-2 pr-2 align-middle">
        <input
          type="number"
          min={0}
          max={100}
          aria-label="Remise ligne"
          className={cn(controlClass, 'w-16 px-2 text-base')}
          value={line.discountRate}
          onChange={(event) => onChange(line.key, { discountRate: Number(event.target.value) || 0 })}
        />
      </td>
      <td className="w-10 py-2 pl-2 align-middle">
        <button
          type="button"
          title="Supprimer la ligne"
          aria-label="Supprimer la ligne"
          className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-danger transition-all duration-200 hover:bg-red-50"
          onClick={() => onRemove(line.key)}
        >
          <IconTrash className="h-4 w-4" />
        </button>
      </td>
    </tr>
  )
})
