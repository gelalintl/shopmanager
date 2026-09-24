import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { formatCompactCfa } from '@/lib/analytics'
import type { MonthPoint } from '@/lib/analytics'

type RevenueChartProps = {
  points: MonthPoint[]
  caption?: string
}

export function RevenueChart({ points, caption = '12 derniers mois' }: RevenueChartProps) {
  const width = 640
  const height = 220
  const pad = { top: 16, right: 12, bottom: 28, left: 8 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const max = Math.max(...points.flatMap((point) => [point.billed, point.collected]), 1)
  const groupW = innerW / Math.max(points.length, 1)
  const barW = Math.max(6, groupW * 0.32)

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <Text weight="bold">Facturé vs encaissé</Text>
          <Caption className="mt-0.5 block">{caption}</Caption>
        </div>
        <div className="flex gap-3 text-xs font-bold">
          <span className="flex items-center gap-1.5 text-primary">
            <span className="h-2 w-2 rounded-full bg-primary" /> Facturé
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Encaissé
          </span>
        </div>
      </div>
      {points.every((point) => point.billed === 0 && point.collected === 0) ? (
        <Text variant="muted">Pas encore d’historique sur cette période.</Text>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Évolution facturé et encaissé">
          {points.map((point, index) => {
            const x = pad.left + index * groupW + groupW / 2
            const billedH = (point.billed / max) * innerH
            const collectedH = (point.collected / max) * innerH
            return (
              <g key={point.key}>
                <rect
                  x={x - barW - 2}
                  y={pad.top + innerH - billedH}
                  width={barW}
                  height={billedH}
                  rx="3"
                  className="fill-primary"
                />
                <rect
                  x={x + 2}
                  y={pad.top + innerH - collectedH}
                  width={barW}
                  height={collectedH}
                  rx="3"
                  className="fill-emerald-500"
                />
                <text x={x} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">
                  {point.label.replace('.', '')}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      <Caption className="mt-2 block">
        Max {formatCompactCfa(max)}
      </Caption>
    </Card>
  )
}
