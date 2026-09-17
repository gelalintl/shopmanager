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
import {
  convertEstimationToInvoice,
  duplicateDocument,
  updateEstimationStatus,
} from '@/app/dashboard/invoices/actions'
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
  createdAt: string
  issueDate?: string
  validityDays?: number
  validUntil?: string | null
}

export function InvoiceDetail(props: InvoiceDetailProps) {
  const router = useRouter()
  const [payOpen, setPayOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const progress = props.totals.ttc > 0 ? Math.min(100, Math.round((props.paidAmount / props.totals.ttc) * 100)) : 0

  async function handleDuplicate() {
    const result = await duplicateDocument(props.estimationPublicId)
    if (result.ok && result.publicId) {
      router.push(`/dashboard/invoices/${result.publicId}`)
      router.refresh()
    }
  }

  async function handleStatus(status: 'SENT' | 'ACCEPTED' | 'REJECTED') {
    const result = await updateEstimationStatus({
      estimationPublicId: props.estimationPublicId,
      status,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Caption className="uppercase tracking-wide">{props.kind === 'INVOICE' ? 'Facture' : 'Devis'}</Caption>
          <Heading as="h2" size="xl">{props.code}</Heading>
          <span className={cn('mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold', statusClass[props.status])}>
            {statusLabels[props.status]}
          </span>
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
          {props.invoicePublicId && props.status !== 'PAID' && props.status !== 'CANCELED' ? (
            <Button variant="secondary" onClick={() => setPayOpen(true)}>Enregistrer un paiement</Button>
          ) : null}
          <Button variant="outline" onClick={handleDuplicate}>Dupliquer</Button>
        </div>
      </div>

      {error ? <Caption color="danger">*{error}</Caption> : null}

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
              if (!result.ok) {
                setError(result.error)
                return
              }
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
