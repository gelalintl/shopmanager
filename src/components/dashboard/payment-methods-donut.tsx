import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { formatCfa } from '@/lib/invoices'
import { paymentMethodLabels, type PaymentMethod } from '@/lib/payments'
import type { MethodShare } from '@/lib/analytics'

const colors: Record<PaymentMethod, string> = {
  CASH: '#059669',
  BANK_TRANSFER: '#1d4ed8',
  CHECK: '#d97706',
  MOBILE_MONEY: '#4f46e5',
}

type PaymentMethodsDonutProps = {
  methods: MethodShare[]
}

export function PaymentMethodsDonut({ methods }: PaymentMethodsDonutProps) {
  const total = methods.reduce((sum, item) => sum + item.amount, 0)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <Card className="p-5">
      <Text weight="bold">Modes de paiement</Text>
      <Caption className="mt-0.5 block">Répartition des encaissements</Caption>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0" role="img" aria-label="Répartition par mode">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="16" />
          {total > 0
            ? methods.map((item) => {
                const length = (item.amount / total) * circumference
                const circle = (
                  <circle
                    key={item.method}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={colors[item.method]}
                    strokeWidth="16"
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 70 70)"
                    strokeLinecap="butt"
                  />
                )
                offset += length
                return circle
              })
            : null}
          <text x="70" y="66" textAnchor="middle" className="fill-slate-900 text-[11px] font-bold">
            Total
          </text>
          <text x="70" y="82" textAnchor="middle" className="fill-slate-500 text-[9px]">
            {total > 0 ? formatCfa(total).replace(' F CFA', '') : '—'}
          </text>
        </svg>
        <ul className="w-full space-y-2">
          {methods.map((item) => (
            <li key={item.method} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[item.method] }} />
                {paymentMethodLabels[item.method]}
              </span>
              <span className="font-bold">{formatCfa(item.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
