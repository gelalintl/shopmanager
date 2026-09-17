'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { InputField } from '@/components/ui/input'
import { deleteProduct, restockProduct } from '@/app/dashboard/products/actions'
import { cn } from '@/lib/cn'
import { formatCfa, getStockStatus, type ProductListItem } from '@/lib/products'

type ProductTableProps = {
  products: ProductListItem[]
  onEdit: (product: ProductListItem) => void
}

const stockBadge: Record<string, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'bg-emerald-50 text-emerald-700' },
  low: { label: 'Alerte', className: 'bg-amber-50 text-amber-700' },
  out: { label: 'Rupture', className: 'bg-red-50 text-red-700' },
}

export function ProductTable({ products, onEdit }: ProductTableProps) {
  const [restocking, setRestocking] = useState<ProductListItem | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function handleDelete(product: ProductListItem) {
    const confirmed = window.confirm(`Supprimer « ${product.designation} » ?`)
    if (!confirmed) return

    setPendingId(product.publicId)
    await deleteProduct(product.publicId)
    setPendingId(null)
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
                <th className="px-4 py-3 text-sm font-bold text-foreground-muted">Actions</th>
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
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            title="Modifier le Produit"
                            onClick={() => onEdit(product)}
                          >
                            Éditer
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            title="Réapprovisionner"
                            onClick={() => setRestocking(product)}
                          >
                            Réapprovisionner
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            title="Supprimer le Produit"
                            isLoading={pendingId === product.publicId}
                            onClick={() => handleDelete(product)}
                          >
                            Supprimer
                          </Button>
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
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const quantity = Number(new FormData(event.currentTarget).get('quantity'))
    setLoading(true)
    setError(null)
    const result = await restockProduct({ publicId: product.publicId, quantity })
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-slate-900/30" aria-label="Fermer" onClick={onClose} />
      <Card className="relative w-full max-w-sm p-6">
        <Text weight="bold">Réapprovisionner {product.designation}</Text>
        <form onSubmit={handleSubmit} className="mt-2">
          {error ? (
            <Caption color="danger" className="italic">
              *{error}
            </Caption>
          ) : null}
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
    </div>
  )
}
