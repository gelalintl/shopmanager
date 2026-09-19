'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { InputField } from '@/components/ui/input'
import { IconPackagePlus, IconPencil, IconTrash } from '@/components/ui/icons'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteProduct, restockProduct } from '@/app/dashboard/products/actions'
import { useRestrictedAction } from '@/components/auth/admin-approval-modal'
import { cn } from '@/lib/cn'
import { formatCfa, getStockStatus, type ProductListItem } from '@/lib/products'
import { toastResult } from '@/lib/notify'
import { toast } from 'sonner'

type ProductTableProps = {
  products: ProductListItem[]
  onEdit: (product: ProductListItem) => void
}

const stockBadge: Record<string, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'bg-emerald-50 text-emerald-700' },
  low: { label: 'Alerte', className: 'bg-amber-50 text-amber-700' },
  out: { label: 'Rupture', className: 'bg-red-50 text-red-700' },
}

const iconBtn =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg p-1.5 transition-all duration-200 disabled:opacity-50'

export function ProductTable({ products, onEdit }: ProductTableProps) {
  const [restocking, setRestocking] = useState<ProductListItem | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const { runRestricted, modal } = useRestrictedAction()

  function handleDelete(product: ProductListItem) {
    void runRestricted({
      title: 'Supprimer le produit',
      description: `Confirmer la suppression de « ${product.designation} ».`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
      successMessage: 'Produit supprimé.',
      run: async (proof) => {
        setPendingId(product.publicId)
        const result = await deleteProduct(product.publicId, proof)
        setPendingId(null)
        return result
      },
    })
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-subtle-border bg-powder/80">
              <tr>
                <th className="px-4 py-3 text-sm font-bold text-foreground-muted">Désignation / Référence</th>
                <th className="px-4 py-3 text-sm font-bold text-foreground-muted">Prix unitaire</th>
                <th className="px-4 py-3 text-sm font-bold text-foreground-muted">Quantité en stock</th>
                <th className="w-36 px-3 py-3 text-sm font-bold text-foreground-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <Text variant="muted">Aucun produit ne correspond à la recherche.</Text>
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const status = getStockStatus(product.quantity, product.alertThreshold)
                  const badge = stockBadge[status]

                  return (
                    <tr key={product.publicId} className="border-b border-subtle-border last:border-0">
                      <td className="px-4 py-3">
                        <Text weight="bold" className="leading-tight">
                          {product.designation}
                        </Text>
                        <Caption className="mt-0.5 block">{product.code}</Caption>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatCfa(product.unitPrice)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-1 text-sm font-bold',
                            badge.className,
                          )}
                        >
                          {product.quantity} · {badge.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Éditer le produit"
                            aria-label="Éditer le produit"
                            className={cn(iconBtn, 'text-slate-600 hover:bg-slate-100 hover:text-blue-600')}
                            onClick={() => onEdit(product)}
                          >
                            <IconPencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Réapprovisionner le stock"
                            aria-label="Réapprovisionner le stock"
                            className={cn(iconBtn, 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700')}
                            onClick={() => setRestocking(product)}
                          >
                            <IconPackagePlus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Supprimer le produit"
                            aria-label="Supprimer le produit"
                            disabled={pendingId === product.publicId}
                            className={cn(iconBtn, 'text-red-600 hover:bg-red-50 hover:text-red-700')}
                            onClick={() => handleDelete(product)}
                          >
                            <IconTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {restocking ? (
        <RestockDialog product={restocking} onClose={() => setRestocking(null)} />
      ) : null}
      {modal}
    </>
  )
}

function RestockDialog({
  product,
  onClose,
}: {
  product: ProductListItem
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const { confirm, dialog } = useConfirmDialog()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const quantity = Number(new FormData(event.currentTarget).get('quantity'))
    if (!Number.isFinite(quantity) || quantity < 1) {
      toast.error('Saisissez une quantité valide.')
      return
    }

    const confirmed = await confirm({
      title: 'Réapprovisionner le stock',
      description: `Ajouter ${quantity} unité(s) à « ${product.designation} » ?`,
      confirmLabel: 'Confirmer',
    })
    if (!confirmed) return

    setLoading(true)
    const result = await restockProduct({ publicId: product.publicId, quantity })
    setLoading(false)
    if (!toastResult(result, 'Stock ajusté.')) return
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-slate-900/30" aria-label="Fermer" onClick={onClose} />
      <Card className="relative w-full max-w-sm p-6">
        <Text weight="bold">Réapprovisionner {product.designation}</Text>
        <form onSubmit={handleSubmit} className="mt-2">
          <InputField
            id="quantity"
            name="quantity"
            label="Quantité"
            type="number"
            min={1}
            step={1}
            defaultValue={1}
            required
          />
          <div className="mt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" isLoading={loading}>
              Valider
            </Button>
          </div>
        </form>
      </Card>
      {dialog}
    </div>
  )
}
