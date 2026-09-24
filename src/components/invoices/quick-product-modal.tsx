'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Heading, Text } from '@/components/ui/typography'
import { InputField } from '@/components/ui/input'
import { createProduct, type ProductSelectItem } from '@/app/dashboard/products/actions'
import { useProductContext } from '@/context/product-context'
import { toastResult } from '@/lib/notify'
import { cn } from '@/lib/cn'
import { isServiceProduct, type ProductKind } from '@/lib/products'

type QuickProductModalProps = {
  open: boolean
  initialName?: string
  onClose: () => void
  onCreated: (product: ProductSelectItem) => void
}

export function QuickProductModal({
  open,
  initialName = '',
  onClose,
  onCreated,
}: QuickProductModalProps) {
  if (!open) return null

  return (
    <QuickProductForm
      key={initialName || 'new'}
      initialName={initialName}
      onClose={onClose}
      onCreated={onCreated}
    />
  )
}

function QuickProductForm({
  initialName,
  onClose,
  onCreated,
}: Omit<QuickProductModalProps, 'open'>) {
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<ProductKind>('MARCHANDISE')
  const { upsertProduct, refreshProducts } = useProductContext()
  const service = isServiceProduct(type)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    form.set('type', type)
    setLoading(true)
    const result = await createProduct(form)
    setLoading(false)
    if (!toastResult(result, 'Produit créé.')) return
    if (!result.product) {
      onClose()
      void refreshProducts()
      return
    }
    upsertProduct(result.product)
    onCreated(result.product)
    onClose()
    void refreshProducts()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-slate-900/30" aria-label="Fermer" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-sm">
        <div className="border-b border-subtle-border px-6 py-5">
          <Heading as="h2" size="lg">
            Nouveau produit rapide
          </Heading>
          <Text variant="muted" size="sm" className="mt-1">
            Saisie minimale. Le produit sera ajouté à la ligne en cours.
          </Text>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-6 pb-6">
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
                    ? 'border-primary bg-primary text-white'
                    : 'border-subtle-border bg-white text-foreground hover:border-primary hover:text-primary',
                )}
              >
                {option === 'MARCHANDISE' ? 'Marchandise' : 'Prestation'}
              </button>
            ))}
          </div>

          <InputField
            id="quick-designation"
            name="designation"
            label="Nom"
            placeholder="Désignation"
            defaultValue={initialName}
            required
            autoFocus
          />
          <InputField
            id="quick-unitPrice"
            name="unitPrice"
            label="Prix de vente"
            type="number"
            min={0}
            step={1}
            placeholder="Prix unitaire"
            required
          />
          {!service ? (
            <InputField
              id="quick-initialQuantity"
              name="initialQuantity"
              label="Stock initial"
              type="number"
              min={0}
              step={1}
              placeholder="Quantité"
              defaultValue={0}
            />
          ) : null}

          <div className="mt-auto flex gap-3 pt-6">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" isLoading={loading}>
              Créer et ajouter
            </Button>
          </div>
        </form>
      </aside>
    </div>
  )
}
