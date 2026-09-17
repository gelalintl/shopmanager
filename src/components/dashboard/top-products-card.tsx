import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { formatCfa } from '@/lib/invoices'
import type { TopProduct } from '@/lib/analytics'

type TopProductsCardProps = {
  products: TopProduct[]
}

export function TopProductsCard({ products }: TopProductsCardProps) {
  const max = Math.max(...products.map((item) => item.revenue), 1)

  return (
    <Card className="p-5">
      <Text weight="bold">Top 5 produits</Text>
      <Caption className="mt-0.5 block">Volume et chiffre d’affaires</Caption>
      {products.length === 0 ? (
        <Text variant="muted" className="mt-4">
          Aucune vente facturée sur la période.
        </Text>
      ) : (
        <ul className="mt-4 space-y-3">
          {products.map((product) => (
            <li key={product.productId}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Text weight="bold" className="truncate">
                    {product.designation}
                  </Text>
                  <Caption className="block">
                    {product.code} · {product.quantity} vendu{product.quantity > 1 ? 's' : ''}
                  </Caption>
                </div>
                <span className="shrink-0 text-sm font-bold">{formatCfa(product.revenue)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft-cobalt">
                <div
                  className="h-full rounded-full bg-cobalt"
                  style={{ width: `${Math.max(8, (product.revenue / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
