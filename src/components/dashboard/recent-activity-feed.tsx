import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { formatCfa, formatFrDate } from '@/lib/invoices'
import type { ActivityItem } from '@/lib/analytics'

const kindLabel: Record<ActivityItem['kind'], string> = {
  INVOICE: 'Facture',
  PAYMENT: 'Règlement',
  ESTIMATION: 'Devis',
}

type RecentActivityFeedProps = {
  items: ActivityItem[]
}

export function RecentActivityFeed({ items }: RecentActivityFeedProps) {
  return (
    <Card className="p-5">
      <Text weight="bold">Activité récente</Text>
      <Caption className="mt-0.5 block">Dernières opérations</Caption>
      {items.length === 0 ? (
        <Text variant="muted" className="mt-4">
          Aucune opération récente.
        </Text>
      ) : (
        <ol className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 border-b border-subtle-border pb-3 last:border-0 last:pb-0">
              <div className="min-w-0">
                <Caption className="block uppercase">{kindLabel[item.kind]}</Caption>
                <Link href={item.href} className="font-bold text-primary hover:underline">
                  {item.title}
                </Link>
                <Caption className="block">
                  {item.detail} · {formatFrDate(item.at)}
                </Caption>
              </div>
              {item.amount !== null ? (
                <span className="shrink-0 text-sm font-bold">{formatCfa(item.amount)}</span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
