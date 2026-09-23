'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Heading, Text } from '@/components/ui/typography'
import { InputField } from '@/components/ui/input'
import { createProduct, updateProduct } from '@/app/dashboard/products/actions'
import { useRestrictedAction } from '@/components/auth/admin-approval-modal'
import { useProductContext } from '@/context/product-context'
import { toastResult } from '@/lib/notify'
import { cn } from '@/lib/cn'
import {
  isServiceProduct,
  parseProductType,
  type ProductKind,
  type ProductListItem,
} from '@/lib/products'

type AddProductModalProps = {
  open: boolean
  product?: ProductListItem | null
  onClose: () => void
}

export function AddProductModal({ open, product, onClose }: AddProductModalProps) {
  if (!open) return null

  return (
    <AddProductForm
      key={product?.publicId ?? 'new'}
      product={product}
      onClose={onClose}
    />
  )
}

function AddProductForm({
  product,
  onClose,
}: {
  product?: ProductListItem | null
  onClose: () => void
}) {
  const editing = Boolean(product)
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<ProductKind>(parseProductType(product?.type))
  const { refreshProducts } = useProductContext()
  const { isManager, runRestricted, modal } = useRestrictedAction()
  const service = isServiceProduct(type)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    form.set('type', type)

    setLoading(true)

    if (editing && product) {
      const payload = {
        publicId: product.publicId,
        designation: String(form.get('designation') ?? ''),
        code: String(form.get('code') ?? ''),
        type,
        unitPrice: Number(form.get('unitPrice')),
        purchasePrice: String(form.get('purchasePrice') ?? '').trim()
          ? Number(form.get('purchasePrice'))
          : null,
        alertThreshold: Number(form.get('alertThreshold') ?? 0),
      }

      const priceChanged = payload.unitPrice !== product.unitPrice
      if (priceChanged && !isManager) {
        setLoading(false)
        void runRestricted({
          title: 'Modifier le prix de vente',
          description: `Validation gestionnaire pour changer le prix de « ${product.designation} ».`,
          successMessage: 'Produit mis à jour.',
          run: async (proof) => {
            setLoading(true)
            const approved = await updateProduct({ ...payload, adminProof: proof })
            setLoading(false)
            if (approved.ok) {
              onClose()
              void refreshProducts()
            }
            return approved
          },
        })
        return
      }

      const result = await updateProduct(payload)
      setLoading(false)
      if (!toastResult(result, 'Produit mis à jour.')) return
      onClose()
      void refreshProducts()
      return
    }

    const result = await createProduct(form)
    setLoading(false)

    if (!toastResult(result, 'Produit créé.')) return

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
              : service
                ? 'Renseignez la désignation et le tarif de la prestation.'
                : 'Renseignez la désignation, les prix et le stock initial.'}
          </Text>
        </div>

        <form
          key={product?.publicId ?? 'new'}
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto px-6 pb-6"
        >
          <input type="hidden" name="type" value={type} />
          <p className="mt-2.5 mb-1 font-sans text-sm font-bold text-foreground">Type</p>
          <div className="flex gap-2" role="group" aria-label="Type de produit">
            {(['MARCHANDISE', 'PRESTATION'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                className={cn(
                  'flex-1 rounded-full border px-3 py-2 text-sm font-bold transition-all duration-200',
                  type === option
                    ? 'border-cobalt bg-cobalt text-white'
                    : 'border-subtle-border bg-white text-foreground hover:border-cobalt hover:text-cobalt',
                )}
              >
                {option === 'MARCHANDISE' ? 'Marchandise' : 'Prestation de service'}
              </button>
            ))}
          </div>

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
          {!service && !editing ? (
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
          {!service ? (
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
          ) : null}

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
      {modal}
    </div>
  )
}
