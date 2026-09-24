'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { PaymentDialog } from '@/components/payments/payment-dialog'
import { formatCfa, formatFrDate } from '@/lib/invoices'
import type { OverdueInvoice } from '@/lib/analytics'

type OverdueInvoicesWidgetProps = {
  invoices: OverdueInvoice[]
}

export function OverdueInvoicesWidget({ invoices }: OverdueInvoicesWidgetProps) {
  const router = useRouter()
  const [paying, setPaying] = useState<OverdueInvoice | null>(null)

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-subtle-border px-5 py-4">
        <Text weight="bold">Factures en retard</Text>
        <Caption className="mt-0.5 block">Échéance dépassée, reste à recouvrer</Caption>
      </div>
      {invoices.length === 0 ? (
        <div className="px-5 py-8">
          <Text variant="muted">Aucune facture en retard.</Text>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left">
            <thead className="bg-powder/80">
              <tr>
                <th className="px-5 py-2 text-xs font-bold text-slate-600">Facture</th>
                <th className="px-5 py-2 text-xs font-bold text-slate-600">Échéance</th>
                <th className="px-5 py-2 text-xs font-bold text-slate-600">Reste</th>
                <th className="px-5 py-2 text-xs font-bold text-slate-600" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.invoicePublicId} className="border-t border-subtle-border">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/invoices/${invoice.estimationPublicId}`} className="font-bold text-primary hover:underline">
                      {invoice.code}
                    </Link>
                    <Caption className="block">{invoice.customerName}</Caption>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {invoice.dueDate ? formatFrDate(invoice.dueDate) : '—'}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap font-bold text-amber-700">
                    {formatCfa(invoice.remaining)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="secondary" size="sm" onClick={() => setPaying(invoice)}>
                      Encaisser
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {paying ? (
        <PaymentDialog
          open
          invoicePublicId={paying.invoicePublicId}
          invoiceCode={paying.code}
          remaining={paying.remaining}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null)
            router.refresh()
          }}
        />
      ) : null}
    </Card>
  )
}
