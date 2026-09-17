'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { InputField } from '@/components/ui/input'
import { createProduct, updateProduct } from '@/app/dashboard/products/actions'
import { useProductContext } from '@/context/product-context'
import type { ProductListItem } from '@/lib/products'

type AddProductModalProps = {
  open: boolean
  product?: ProductListItem | null
  onClose: () => void
}

export function AddProductModal({ open, product, onClose }: AddProductModalProps) {
  const editing = Boolean(product)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { refreshProducts } = useProductContext()

  if (!open) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    setLoading(true)
    setError(null)

    const result = editing && product
      ? await updateProduct({
          publicId: product.publicId,
          designation: String(form.get('designation') ?? ''),
          code: String(form.get('code') ?? ''),
          unitPrice: Number(form.get('unitPrice')),
          purchasePrice: String(form.get('purchasePrice') ?? '').trim()
            ? Number(form.get('purchasePrice'))
            : null,
          alertThreshold: Number(form.get('alertThreshold') ?? 0),
        })
      : await createProduct(form)

    setLoading(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    onClose()
    void refreshProducts()
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30"
        aria-label="Fermer"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-sm">
        <div className="border-b border-subtle-border px-6 py-5">
          <Heading as="h2" size="lg">
            {editing ? 'Modifier le produit' : 'Nouveau produit'}
          </Heading>
          <Text variant="muted" size="sm" className="mt-1">
            {editing
              ? 'Mettez à jour la fiche article.'
              : 'Renseignez la désignation, les prix et le stock initial.'}
          </Text>
        </div>

        <form
          key={product?.publicId ?? 'new'}
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto px-6 pb-6"
        >
          {error ? (
            <Caption color="danger" className="mt-3 italic">
              *{error}
            </Caption>
          ) : null}

          <InputField
            id="designation"
            name="designation"
            label="Nom / Désignation"
            placeholder="Nom produit"
            defaultValue={product?.designation}
            required
          />
          <InputField
            id="code"
            name="code"
            label="Référence / Code"
            placeholder="Ex. CAB001"
            defaultValue={product?.code}
          />
          <InputField
            id="unitPrice"
            name="unitPrice"
            label="Prix de vente"
            type="number"
            min={0}
            step={1}
            placeholder="Prix unitaire"
            defaultValue={product?.unitPrice}
            required
          />
          <InputField
            id="purchasePrice"
            name="purchasePrice"
            label="Prix d'achat (optionnel)"
            type="number"
            min={0}
            step={1}
            placeholder="Prix d'achat"
            defaultValue={product?.purchasePrice ?? undefined}
          />
          {!editing ? (
            <InputField
              id="initialQuantity"
              name="initialQuantity"
              label="Quantité initiale"
              type="number"
              min={0}
              step={1}
              placeholder="Quantité"
              defaultValue={0}
            />
          ) : null}
          <InputField
            id="alertThreshold"
            name="alertThreshold"
            label="Seuil d'alerte"
            type="number"
            min={0}
            step={1}
            placeholder="Seuil minimum"
            defaultValue={product?.alertThreshold ?? 0}
          />

          <div className="mt-auto flex gap-3 pt-6">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" isLoading={loading}>
              {editing ? 'Modifier' : 'Valider'}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  )
}
