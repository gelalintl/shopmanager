'use client'

import { FormEvent, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { InputField } from '@/components/ui/input'
import { InvoicePrintTemplate } from '@/components/invoices/invoice-print-template'
import { PaymentDialog } from '@/components/payments/payment-dialog'
import { CreditNoteBadge, CreditNoteModal } from '@/components/invoices/credit-note-modal'
import {
  cancelInvoice,
  convertEstimationToInvoice,
  duplicateDocument,
  reviewInvoiceCancellation,
  updateEstimationStatus,
} from '@/app/dashboard/invoices/actions'
import { useRestrictedAction } from '@/components/auth/admin-approval-modal'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toastResult } from '@/lib/notify'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import type { CreditNoteHistoryItem } from '@/lib/credit-notes'
import {
  CancellationRequestBadge,
  CancellationRequestModal,
} from '@/components/invoices/cancellation-request-modal'
import {
  formatCfa,
  formatFrDate,
  statusClass,
  statusLabels,
  type DocumentKind,
  type DocumentStatus,
  type DocumentTotals,
  type PrintCompany,
  type PrintCustomer,
  type PrintSettings,
} from '@/lib/invoices'
import { cn } from '@/lib/cn'

export type PaymentEntry = {
  publicId: string
  amount: number
  paymentDate: string
  note: string | null
  paymentMethod?: string
}

type InvoiceDetailProps = {
  kind: DocumentKind
  estimationPublicId: string
  invoicePublicId: string | null
  code: string
  status: DocumentStatus
  customer: PrintCustomer
  company: PrintCompany
  lines: Array<{
    designation: string
    quantity: number
    unitPrice: number
    discountRate: number
    ht: number
  }>
  totals: DocumentTotals
  warranty: number
  notes: string | null
  settings: PrintSettings
  paidAmount: number
  remaining: number
  payments: PaymentEntry[]
  creditNotes?: CreditNoteHistoryItem[]
  creditNoteCount?: number
  cancelReason?: string | null
  cancelRequestedAt?: string | null
  createdAt: string
  issueDate?: string
  validityDays?: number
  validUntil?: string | null
}

export function InvoiceDetail(props: InvoiceDetailProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const isManager = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'
  const [payOpen, setPayOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [creditOpen, setCreditOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const progress = props.totals.ttc > 0 ? Math.min(100, Math.round((props.paidAmount / props.totals.ttc) * 100)) : 0
  const { runRestricted, modal } = useRestrictedAction()
  const { confirm, dialog } = useConfirmDialog()
  const creditNotes = props.creditNotes ?? []
  const pendingCancel = props.status === 'PENDING_CANCELLATION'

  async function handleDuplicate() {
    const result = await duplicateDocument(props.estimationPublicId)
    if (toastResult(result, 'Document dupliqué.')) {
      if (result.publicId) router.push(`/dashboard/invoices/${result.publicId}`)
      router.refresh()
    }
  }

  async function handleStatus(status: 'SENT' | 'ACCEPTED' | 'REJECTED') {
    const result = await updateEstimationStatus({
      estimationPublicId: props.estimationPublicId,
      status,
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    if (status === 'SENT') toast.success('Devis marqué comme envoyé.')
    else if (status === 'ACCEPTED') toast.success('Devis accepté.')
    else toast.error('Devis refusé.')
    router.refresh()
  }

  async function handleReview(approved: boolean) {
    if (!props.invoicePublicId) return
    const confirmed = await confirm({
      title: approved ? 'Approuver l’annulation' : 'Rejeter la demande',
      description: approved
        ? `Approuver l’annulation de ${props.code} ? Le stock sera réintégré.`
        : `Rejeter la demande d’annulation de ${props.code} ? La facture reprendra son statut d’origine.`,
      confirmLabel: approved ? 'Approuver' : 'Rejeter',
      variant: approved ? 'solid' : 'danger',
    })
    if (!confirmed) return
    setReviewing(true)
    const result = await reviewInvoiceCancellation(props.invoicePublicId, approved)
    setReviewing(false)
    if (result.ok) {
      if (approved) toast.success('Annulation approuvée. Le stock a été réintégré.')
      else toast.error('Demande d’annulation rejetée.')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Caption className="uppercase tracking-wide">{props.kind === 'INVOICE' ? 'Facture' : 'Devis'}</Caption>
          <Heading as="h2" size="xl">{props.code}</Heading>
          {props.status === 'PENDING_CANCELLATION' ? (
            <span className="ml-2">
              <CancellationRequestBadge reason={props.cancelReason} />
            </span>
          ) : (
            <span className={cn('mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold', statusClass[props.status])}>
              {statusLabels[props.status]}
            </span>
          )}
          {creditNotes.length > 0 ? (
            <span className="ml-2">
              <CreditNoteBadge count={creditNotes.length} href="#avoirs" />
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/invoices/${props.estimationPublicId}/print`} target="_blank">
            <Button variant="outline">Imprimer</Button>
          </Link>
          <Link href={`/dashboard/invoices/${props.estimationPublicId}/print?download=1`} target="_blank">
            <Button variant="secondary">Télécharger PDF</Button>
          </Link>
          {props.kind === 'ESTIMATION' && (props.status === 'DRAFT' || props.status === 'REJECTED') ? (
            <Button variant="outline" onClick={() => handleStatus('SENT')}>Marquer envoyé</Button>
          ) : null}
          {props.kind === 'ESTIMATION' && props.status === 'SENT' ? (
            <>
              <Button variant="secondary" onClick={() => handleStatus('ACCEPTED')}>Accepter</Button>
              <Button variant="danger" onClick={() => handleStatus('REJECTED')}>Refuser</Button>
            </>
          ) : null}
          {props.kind === 'ESTIMATION' && props.status !== 'INVOICED' && props.status !== 'CANCELED' && props.status !== 'REJECTED' ? (
            <Button onClick={() => setConvertOpen(true)}>Convertir</Button>
          ) : null}
          {props.invoicePublicId && props.status !== 'PAID' && props.status !== 'CANCELED' && !pendingCancel ? (
            <Button variant="secondary" onClick={() => setPayOpen(true)}>Enregistrer un paiement</Button>
          ) : null}
          {props.invoicePublicId && props.status !== 'CANCELED' && !pendingCancel ? (
            <Button variant="secondary" onClick={() => setCreditOpen(true)}>
              Créer un Avoir / Remboursement
            </Button>
          ) : null}
          {!isManager && props.invoicePublicId && props.status !== 'CANCELED' && !pendingCancel ? (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              Demander l’annulation
            </Button>
          ) : null}
          {isManager && props.invoicePublicId && pendingCancel ? (
            <>
              <Button isLoading={reviewing} onClick={() => void handleReview(true)}>
                Approuver l’annulation
              </Button>
              <Button variant="outline" disabled={reviewing} onClick={() => void handleReview(false)}>
                Rejeter la demande
              </Button>
            </>
          ) : null}
          {isManager && props.invoicePublicId && props.status !== 'CANCELED' && !pendingCancel ? (
            <Button
              variant="danger"
              onClick={() =>
                void runRestricted({
                  title: 'Annuler la facture',
                  description: `Confirmer l’annulation de ${props.code}. Les règlements liés seront annulés et le stock réintégré.`,
                  requireReason: true,
                  successMessage: 'Facture annulée.',
                  run: async (proof) => {
                    const result = await cancelInvoice(props.invoicePublicId as string, proof)
                    if (result.ok) router.refresh()
                    return result
                  },
                })
              }
            >
              Annuler
            </Button>
          ) : null}
          <Button variant="outline" onClick={handleDuplicate}>Dupliquer</Button>
        </div>
      </div>

      {pendingCancel && props.cancelReason ? (
        <Card className="border border-red-200 bg-red-50 p-5">
          <Text weight="bold" className="text-red-800">Demande d’annulation en attente</Text>
          <Caption className="mt-1 block text-red-700">Motif : {props.cancelReason}</Caption>
        </Card>
      ) : null}

      {props.invoicePublicId ? (
        <Card className="p-5">
          <Text weight="bold">Suivi des règlements</Text>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-soft-cobalt">
            <div className="h-full rounded-full bg-cobalt transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
          <Caption className="mt-2 block">
            {formatCfa(props.paidAmount)} / {formatCfa(props.totals.ttc)} ({progress} %) — reste {formatCfa(props.remaining)}
          </Caption>
          <ol className="mt-4 space-y-2">
            {props.payments.length === 0 ? (
              <Text variant="muted" size="sm">Aucun règlement enregistré.</Text>
            ) : (
              props.payments.map((payment) => (
                <li key={payment.publicId} className="flex items-start justify-between border-b border-subtle-border pb-2">
                  <div>
                    <Text size="sm" weight="bold">{formatCfa(payment.amount)}</Text>
                    {payment.note ? <Caption className="block">{payment.note}</Caption> : null}
                    <Link href={`/dashboard/payments/${payment.publicId}/print`} target="_blank" className="text-sm font-bold text-cobalt hover:underline">
                      Reçu
                    </Link>
                  </div>
                  <Caption>{new Date(payment.paymentDate).toLocaleDateString('fr-FR')}</Caption>
                </li>
              ))
            )}
          </ol>
        </Card>
      ) : null}

      {props.invoicePublicId ? (
        <Card className="p-5" id="avoirs">
          <Text weight="bold">Historique des avoirs</Text>
          {creditNotes.length === 0 ? (
            <Text variant="muted" size="sm" className="mt-3">
              Aucun avoir émis sur cette facture.
            </Text>
          ) : (
            <ol className="mt-4 space-y-2">
              {creditNotes.map((note) => (
                <li key={note.publicId} className="flex items-start justify-between border-b border-subtle-border pb-2">
                  <div>
                    <Text size="sm" weight="bold">
                      {note.code} · {formatCfa(note.amount)}
                    </Text>
                    <Caption className="block">
                      {note.reason}
                      {note.restock ? ' · Stock réintégré' : ''}
                    </Caption>
                    <Caption className="block">Émis par {note.cashierName}</Caption>
                    <Link
                      href={`/dashboard/invoices/credit-notes/${note.publicId}/print?format=ticket`}
                      target="_blank"
                      className="text-sm font-bold text-cobalt hover:underline"
                    >
                      Imprimer le reçu d’avoir
                    </Link>
                  </div>
                  <Caption>{new Date(note.createdAt).toLocaleDateString('fr-FR')}</Caption>
                </li>
              ))}
            </ol>
          )}
        </Card>
      ) : null}

      <div className="overflow-auto rounded-2xl bg-powder p-4">
        <div className="mx-auto w-[210mm]">
          <InvoicePrintTemplate
            kind={props.kind}
            code={props.code}
            dateLabel={`Niamey, le ${formatFrDate(props.issueDate ?? props.createdAt)}`}
            company={props.company}
            customer={props.customer}
            lines={props.lines}
            totals={props.totals}
            warranty={props.warranty}
            settings={props.settings}
            paidAmount={props.paidAmount}
            notes={props.notes}
            validityDays={props.kind === 'ESTIMATION' ? props.validityDays : undefined}
            validUntil={props.kind === 'ESTIMATION' ? props.validUntil : null}
          />
        </div>
      </div>

      {convertOpen ? (
        <ActionModal title="Convertir en facture" onClose={() => setConvertOpen(false)}>
          <form
            onSubmit={async (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              const type = String(form.get('depositType') || 'none') as 'none' | 'percent' | 'amount'
              const result = await convertEstimationToInvoice({
                estimationPublicId: props.estimationPublicId,
                depositType: type === 'none' ? null : type,
                depositValue: Number(form.get('depositValue') || 0),
              })
              if (!toastResult(result, 'Facture créée.')) return
              setConvertOpen(false)
              router.refresh()
            }}
          >
            <label className="block text-sm font-bold">
              Acompte
              <select name="depositType" className="mt-1 min-h-10 w-full rounded-md border border-subtle-border px-3 font-normal">
                <option value="none">Sans acompte</option>
                <option value="percent">Pourcentage</option>
                <option value="amount">Montant fixe</option>
              </select>
            </label>
            <InputField id="depositValue" name="depositValue" label="Valeur" type="number" min={0} defaultValue={0} />
            <Button type="submit" className="mt-4 w-full">Convertir</Button>
          </form>
        </ActionModal>
      ) : null}

      {payOpen && props.invoicePublicId ? (
        <PaymentDialog
          open
          invoicePublicId={props.invoicePublicId}
          invoiceCode={props.code}
          remaining={props.remaining}
          onClose={() => setPayOpen(false)}
          onDone={() => {
            setPayOpen(false)
            router.refresh()
          }}
        />
      ) : null}
      {creditOpen && props.invoicePublicId ? (
        <CreditNoteModal
          open
          invoicePublicId={props.invoicePublicId}
          invoiceCode={props.code}
          maxAmount={props.paidAmount}
          onClose={() => setCreditOpen(false)}
          onDone={(publicId) => {
            setCreditOpen(false)
            router.refresh()
            window.open(`/dashboard/invoices/credit-notes/${publicId}/print?format=ticket`, '_blank')
          }}
        />
      ) : null}
      {cancelOpen && props.invoicePublicId ? (
        <CancellationRequestModal
          open
          invoicePublicId={props.invoicePublicId}
          invoiceCode={props.code}
          onClose={() => setCancelOpen(false)}
          onDone={() => {
            setCancelOpen(false)
            router.refresh()
          }}
        />
      ) : null}
      {modal}
      {dialog}
    </div>
  )
}

function ActionModal({
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
