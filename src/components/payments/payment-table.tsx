'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { IconPrinter, IconTrash } from '@/components/ui/icons'
import { cancelPayment } from '@/app/dashboard/payments/actions'
import { formatCfa, formatFrDate } from '@/lib/invoices'
import {
  paymentMethodClass,
  paymentMethodLabels,
  type PaymentJournalEntry,
} from '@/lib/payments'
import { cn } from '@/lib/cn'

const iconBtn =
  'inline-flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200'

type PaymentTableProps = {
  entries: PaymentJournalEntry[]
}

export function PaymentTable({ entries }: PaymentTableProps) {
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function handleCancel(entry: PaymentJournalEntry) {
    const confirmed = window.confirm(
      `Annuler le règlement de ${formatCfa(entry.amount)} sur ${entry.invoiceCode} ?`,
    )
    if (!confirmed) return
    setPendingId(entry.publicId)
    await cancelPayment(entry.publicId)
    setPendingId(null)
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] table-fixed text-left">
          <thead className="border-b border-subtle-border bg-powder/80">
            <tr>
              <th className="w-44 px-4 py-3 text-sm font-bold text-foreground-muted">Date & heure</th>
              <th className="w-36 px-4 py-3 text-sm font-bold text-foreground-muted">N° Facture</th>
              <th className="px-4 py-3 text-sm font-bold text-foreground-muted">Client</th>
              <th className="w-40 px-4 py-3 text-sm font-bold text-foreground-muted">Mode</th>
              <th className="w-40 px-4 py-3 text-sm font-bold text-foreground-muted">Montant</th>
              <th className="w-40 px-4 py-3 text-sm font-bold text-foreground-muted">Agent</th>
              <th className="w-28 px-3 py-3 text-sm font-bold text-foreground-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <Text variant="muted">Aucun encaissement pour ces filtres.</Text>
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.publicId} className="border-b border-subtle-border last:border-0">
                  <td className="px-4 py-3 align-middle whitespace-nowrap">
                    {formatFrDate(entry.paymentDate)}
                    <Caption className="block">
                      {new Date(entry.paymentDate).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Caption>
                  </td>
                  <td className="overflow-hidden px-4 py-3 align-middle">
                    <Link
                      href={`/dashboard/invoices/${entry.estimationPublicId}`}
                      className="font-bold text-cobalt hover:underline"
                    >
                      {entry.invoiceCode}
                    </Link>
                  </td>
                  <td className="overflow-hidden px-4 py-3 align-middle">
                    <span className="block truncate">{entry.customerName}</span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-1 text-xs font-bold',
                        paymentMethodClass[entry.paymentMethod],
                      )}
                    >
                      {paymentMethodLabels[entry.paymentMethod]}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle whitespace-nowrap font-bold">
                    {formatCfa(entry.amount)}
                  </td>
                  <td className="overflow-hidden px-4 py-3 align-middle">
                    <span className="block truncate">{entry.collectorName}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-middle">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/dashboard/payments/${entry.publicId}/print`}
                        target="_blank"
                        title="Imprimer le reçu"
                        aria-label="Imprimer le reçu"
                        className={cn(iconBtn, 'text-cobalt hover:bg-soft-cobalt')}
                      >
                        <IconPrinter className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        title="Annuler le règlement"
                        aria-label="Annuler le règlement"
                        disabled={pendingId === entry.publicId}
                        className={cn(iconBtn, 'text-danger hover:bg-red-50 disabled:opacity-50')}
                        onClick={() => handleCancel(entry)}
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
