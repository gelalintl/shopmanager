'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { IconPrinter, IconTrash, IconUndo } from '@/components/ui/icons'
import { SortableHeader } from '@/components/ui/sortable-header'
import { cancelPayment } from '@/app/dashboard/payments/actions'
import { createCreditNote } from '@/app/dashboard/collections/actions'
import { CreditNoteBadge, CreditNoteModal } from '@/components/invoices/credit-note-modal'
import { useRestrictedAction } from '@/components/auth/admin-approval-modal'
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
  const router = useRouter()
  const { data: session } = useSession()
  const isManager = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [creditEntry, setCreditEntry] = useState<PaymentJournalEntry | null>(null)
  const { runRestricted, modal } = useRestrictedAction()

  function handleCancel(entry: PaymentJournalEntry) {
    void runRestricted({
      title: 'Annuler le règlement',
      description: `Validation gestionnaire pour annuler ${formatCfa(entry.amount)} sur ${entry.invoiceCode}.`,
      requireReason: true,
      successMessage: 'Règlement annulé.',
      run: async (proof) => {
        setPendingId(entry.publicId)
        const result = await cancelPayment(entry.publicId, proof)
        setPendingId(null)
        if (result.ok) router.refresh()
        return result
      },
    })
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] table-fixed text-left">
          <thead className="border-b border-subtle-border bg-powder/80">
            <tr>
              <SortableHeader className="w-44" sortKey="date" label="Date & heure" fallbackKey="date" fallbackDir="desc" initialDir="desc" />
              <SortableHeader className="w-36" sortKey="invoice" label="N° Facture" fallbackKey="date" fallbackDir="desc" />
              <SortableHeader sortKey="customer" label="Client" fallbackKey="date" fallbackDir="desc" />
              <SortableHeader className="w-40" sortKey="method" label="Mode" fallbackKey="date" fallbackDir="desc" />
              <SortableHeader className="w-40" sortKey="amount" label="Montant" fallbackKey="date" fallbackDir="desc" initialDir="desc" />
              <SortableHeader className="w-40" sortKey="agent" label="Agent" fallbackKey="date" fallbackDir="desc" />
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
                    {entry.hasCreditNotes ? (
                      <div className="mt-1">
                        <CreditNoteBadge
                          count={entry.creditNoteCount}
                          href={`/dashboard/invoices/${entry.estimationPublicId}#avoirs`}
                        />
                      </div>
                    ) : null}
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
                        title="Créer un Avoir / Remboursement"
                        aria-label="Créer un Avoir / Remboursement"
                        className={cn(iconBtn, 'text-orange-700 hover:bg-orange-50')}
                        onClick={() => setCreditEntry(entry)}
                      >
                        <IconUndo className="h-4 w-4" />
                      </button>
                      {isManager ? (
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
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {creditEntry ? (
        <CreditNoteModal
          open
          invoicePublicId={creditEntry.invoicePublicId}
          invoiceCode={creditEntry.invoiceCode}
          maxAmount={creditEntry.refundableAmount}
          createAction={createCreditNote}
          onClose={() => setCreditEntry(null)}
          onDone={(publicId) => {
            setCreditEntry(null)
            router.refresh()
            window.open(`/dashboard/invoices/credit-notes/${publicId}/print?format=ticket`, '_blank')
          }}
        />
      ) : null}
      {modal}
    </Card>
  )
}
