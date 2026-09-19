'use client'

import { FormEvent, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { InputField } from '@/components/ui/input'
import {
  cancelInvoice,
  convertEstimationToInvoice,
  reviewInvoiceCancellation,
} from '@/app/dashboard/invoices/actions'
import { PaymentDialog } from '@/components/payments/payment-dialog'
import { CreditNoteBadge, CreditNoteModal } from '@/components/invoices/credit-note-modal'
import {
  CancellationRequestBadge,
  CancellationRequestModal,
} from '@/components/invoices/cancellation-request-modal'
import { useRestrictedAction } from '@/components/auth/admin-approval-modal'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toastResult } from '@/lib/notify'
import { toast } from 'sonner'
import {
  formatCfa,
  statusClass,
  statusLabels,
  type DocumentListItem,
} from '@/lib/invoices'
import { cn } from '@/lib/cn'
import {
  IconArrowRightLeft,
  IconBan,
  IconCheckCircle,
  IconEye,
  IconPrinter,
  IconTrash,
  IconUndo,
  IconXCircle,
} from '@/components/ui/icons'

type InvoiceTableProps = {
  documents: DocumentListItem[]
}

export function InvoiceTable({ documents }: InvoiceTableProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const isManager = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'
  const [convertId, setConvertId] = useState<string | null>(null)
  const [payId, setPayId] = useState<string | null>(null)
  const [creditDoc, setCreditDoc] = useState<DocumentListItem | null>(null)
  const [cancelDoc, setCancelDoc] = useState<DocumentListItem | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const { runRestricted, modal } = useRestrictedAction()
  const { confirm, dialog } = useConfirmDialog()

  const convertDoc = documents.find((item) => item.estimationPublicId === convertId)
  const payDoc = documents.find((item) => item.invoicePublicId === payId)

  async function handleReview(invoicePublicId: string, approved: boolean, code: string) {
    const confirmed = await confirm({
      title: approved ? 'Approuver l’annulation' : 'Rejeter la demande',
      description: approved
        ? `Approuver l’annulation de ${code} ? Le stock sera réintégré.`
        : `Rejeter la demande d’annulation de ${code} ? La facture reprendra son statut d’origine.`,
      confirmLabel: approved ? 'Approuver' : 'Rejeter',
      variant: approved ? 'solid' : 'danger',
    })
    if (!confirmed) return
    setReviewId(invoicePublicId)
    const result = await reviewInvoiceCancellation(invoicePublicId, approved)
    setReviewId(null)
    if (result.ok) {
      if (approved) toast.success('Annulation approuvée. Le stock a été réintégré.')
      else toast.error('Demande d’annulation rejetée.')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] table-fixed text-left">
            <thead className="border-b border-subtle-border bg-powder/80">
              <tr>
                <th className="px-4 py-3 text-sm font-bold text-foreground-muted">Référence</th>
                <th className="px-4 py-3 text-sm font-bold text-foreground-muted">Client</th>
                <th className="w-32 px-4 py-3 text-sm font-bold text-foreground-muted">Statut</th>
                <th className="w-36 px-4 py-3 text-sm font-bold text-foreground-muted">TTC</th>
                <th className="w-36 px-4 py-3 text-sm font-bold text-foreground-muted">Reste</th>
                <th className="w-40 px-3 py-3 text-sm font-bold text-foreground-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <Text variant="muted">Aucun document pour cet onglet.</Text>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={`${doc.kind}-${doc.publicId}`} className="border-b border-subtle-border last:border-0">
                    <td className="overflow-hidden px-4 py-3 align-middle">
                      <Text weight="bold" className="truncate">{doc.code}</Text>
                      <Caption className="block">{doc.kind === 'INVOICE' ? 'Facture' : 'Devis'}</Caption>
                      {doc.kind === 'INVOICE' ? (
                        <CreditNoteBadge
                          count={doc.creditNoteCount}
                          href={`/dashboard/invoices/${doc.estimationPublicId}#avoirs`}
                        />
                      ) : null}
                    </td>
                    <td className="overflow-hidden px-4 py-3 align-middle">
                      <span className="block truncate">{doc.customerName}</span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {doc.status === 'PENDING_CANCELLATION' ? (
                        <CancellationRequestBadge reason={doc.cancelReason} />
                      ) : (
                        <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-bold', statusClass[doc.status])}>
                          {statusLabels[doc.status]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap">{formatCfa(doc.totalTtc)}</td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap">{formatCfa(doc.remaining)}</td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/invoices/${doc.estimationPublicId}`}
                          title="Consulter"
                          aria-label="Consulter"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-cobalt transition-all duration-200 hover:bg-soft-cobalt"
                        >
                          <IconEye className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/dashboard/invoices/${doc.estimationPublicId}/print`}
                          target="_blank"
                          title="Imprimer"
                          aria-label="Imprimer"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-cobalt transition-all duration-200 hover:bg-soft-cobalt"
                        >
                          <IconPrinter className="h-4 w-4" />
                        </Link>
                        {doc.kind === 'ESTIMATION' && doc.status !== 'INVOICED' && doc.status !== 'CANCELED' && doc.status !== 'REJECTED' ? (
                          <button
                            type="button"
                            title="Action rapide"
                            aria-label="Convertir en facture"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-cobalt transition-all duration-200 hover:bg-soft-cobalt"
                            onClick={() => setConvertId(doc.estimationPublicId)}
                          >
                            <IconArrowRightLeft className="h-4 w-4" />
                          </button>
                        ) : null}
                        {doc.invoicePublicId && doc.status !== 'PAID' && doc.status !== 'CANCELED' && doc.status !== 'PENDING_CANCELLATION' ? (
                          <button
                            type="button"
                            title="Action rapide"
                            aria-label="Enregistrer un règlement"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-cobalt transition-all duration-200 hover:bg-soft-cobalt"
                            onClick={() => setPayId(doc.invoicePublicId)}
                          >
                            <IconCheckCircle className="h-4 w-4" />
                          </button>
                        ) : null}
                        {doc.kind === 'INVOICE' && doc.invoicePublicId && doc.status !== 'CANCELED' && doc.status !== 'PENDING_CANCELLATION' ? (
                          <button
                            type="button"
                            title="Créer un Avoir / Remboursement"
                            aria-label="Créer un Avoir / Remboursement"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-orange-700 transition-all duration-200 hover:bg-orange-50"
                            onClick={() => setCreditDoc(doc)}
                          >
                            <IconUndo className="h-4 w-4" />
                          </button>
                        ) : null}
                        {!isManager && doc.kind === 'INVOICE' && doc.invoicePublicId && doc.status !== 'CANCELED' && doc.status !== 'PENDING_CANCELLATION' ? (
                          <button
                            type="button"
                            title="Demander l’annulation"
                            aria-label="Demander l’annulation"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg p-1.5 text-red-600 transition-all duration-200 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setCancelDoc(doc)}
                          >
                            <IconBan className="h-4 w-4" />
                          </button>
                        ) : null}
                        {isManager && doc.kind === 'INVOICE' && doc.invoicePublicId && doc.status === 'PENDING_CANCELLATION' ? (
                          <>
                            <button
                              type="button"
                              title="Approuver l’annulation"
                              aria-label="Approuver l’annulation"
                              disabled={reviewId === doc.invoicePublicId}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg p-1.5 text-emerald-600 transition-all duration-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                              onClick={() => void handleReview(doc.invoicePublicId as string, true, doc.code)}
                            >
                              <IconCheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Rejeter la demande"
                              aria-label="Rejeter la demande"
                              disabled={reviewId === doc.invoicePublicId}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg p-1.5 text-red-600 transition-all duration-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                              onClick={() => void handleReview(doc.invoicePublicId as string, false, doc.code)}
                            >
                              <IconXCircle className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}
                        {isManager && doc.kind === 'INVOICE' && doc.invoicePublicId && doc.status !== 'CANCELED' && doc.status !== 'PENDING_CANCELLATION' ? (
                          <button
                            type="button"
                            title="Annuler la facture"
                            aria-label="Annuler la facture"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-danger transition-all duration-200 hover:bg-red-50"
                            onClick={() =>
                              void runRestricted({
                                title: 'Annuler la facture',
                                description: `Confirmer l’annulation de ${doc.code}. Le stock sera réintégré.`,
                                requireReason: true,
                                successMessage: 'Facture annulée.',
                                run: async (proof) => {
                                  const result = await cancelInvoice(doc.invoicePublicId as string, proof)
                                  if (result.ok) router.refresh()
                                  return result
                                },
                              })
                            }
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
      </Card>

      {convertDoc ? (
        <ConvertDialog
          document={convertDoc}
          onClose={() => setConvertId(null)}
          onDone={(id) => {
            setConvertId(null)
            router.push(`/dashboard/invoices/${id}`)
            router.refresh()
          }}
        />
      ) : null}

      {payDoc?.invoicePublicId ? (
        <PaymentDialog
          open
          invoicePublicId={payDoc.invoicePublicId}
          invoiceCode={payDoc.code}
          remaining={payDoc.remaining}
          onClose={() => setPayId(null)}
          onDone={() => {
            setPayId(null)
            router.refresh()
          }}
        />
      ) : null}
      {creditDoc?.invoicePublicId ? (
        <CreditNoteModal
          open
          invoicePublicId={creditDoc.invoicePublicId}
          invoiceCode={creditDoc.code}
          maxAmount={creditDoc.paidAmount}
          onClose={() => setCreditDoc(null)}
          onDone={(publicId) => {
            setCreditDoc(null)
            router.refresh()
            window.open(`/dashboard/invoices/credit-notes/${publicId}/print?format=ticket`, '_blank')
          }}
        />
      ) : null}
      {cancelDoc?.invoicePublicId ? (
        <CancellationRequestModal
          open
          invoicePublicId={cancelDoc.invoicePublicId}
          invoiceCode={cancelDoc.code}
          onClose={() => setCancelDoc(null)}
          onDone={() => {
            setCancelDoc(null)
            router.refresh()
          }}
        />
      ) : null}
      {modal}
      {dialog}
    </>
  )
}

function ConvertDialog({
  document,
  onClose,
  onDone,
}: {
  document: DocumentListItem
  onClose: () => void
  onDone: (id: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [depositType, setDepositType] = useState<'none' | 'percent' | 'amount'>('none')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setLoading(true)
    const result = await convertEstimationToInvoice({
      estimationPublicId: document.estimationPublicId,
      depositType: depositType === 'none' ? null : depositType,
      depositValue: Number(form.get('depositValue') || 0),
      dueDate: String(form.get('dueDate') || '') || null,
    })
    setLoading(false)
    if (!toastResult(result, 'Facture créée.')) return
    onDone(result.publicId ?? document.estimationPublicId)
  }

  return (
    <Modal title={`Convertir ${document.code} en facture`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className="mt-2 block text-sm font-bold">
          Acompte
          <select
            className="mt-1 min-h-10 w-full rounded-md border border-subtle-border px-3 font-normal"
            value={depositType}
            onChange={(event) => setDepositType(event.target.value as typeof depositType)}
          >
            <option value="none">Sans acompte</option>
            <option value="percent">Pourcentage</option>
            <option value="amount">Montant fixe</option>
          </select>
        </label>
        {depositType !== 'none' ? (
          <InputField
            id="depositValue"
            name="depositValue"
            label={depositType === 'percent' ? 'Pourcentage (%)' : 'Montant (F CFA)'}
            type="number"
            min={0}
            required
          />
        ) : null}
        <InputField id="dueDate" name="dueDate" label="Échéance" type="date" />
        <div className="mt-4 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button type="submit" className="flex-1" isLoading={loading}>Convertir</Button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-slate-900/30" aria-label="Fermer" onClick={onClose} />
      <Card className="relative w-full max-w-md p-6">
        <Text weight="bold">{title}</Text>
        <div className="mt-3">{children}</div>
      </Card>
    </div>
  )
}
