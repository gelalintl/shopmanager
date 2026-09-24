'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { InputField, controlClass } from '@/components/ui/input'
import { createCreditNote as createInvoiceCreditNote } from '@/app/dashboard/invoices/actions'
import { CREDIT_NOTE_REASONS, type CreditNoteActionResult, type CreditNoteInput } from '@/lib/credit-notes'
import { formatCfa } from '@/lib/invoices'
import { toastResult } from '@/lib/notify'

type CreditNoteModalProps = {
  open: boolean
  invoicePublicId: string
  invoiceCode: string
  maxAmount: number
  onClose: () => void
  onDone?: (publicId: string) => void
  createAction?: (data: CreditNoteInput) => Promise<CreditNoteActionResult>
}

export function CreditNoteModal({
  open,
  invoicePublicId,
  invoiceCode,
  maxAmount,
  onClose,
  onDone,
  createAction = createInvoiceCreditNote,
}: CreditNoteModalProps) {
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amount = Math.round(Number(form.get('amount')) || 0)
    const reason = String(form.get('reason') ?? '').trim()
    const restock = form.get('restock') === 'on'
    setLoading(true)
    const result = await createAction({
      invoicePublicId,
      amount,
      reason,
      restock,
    })
    setLoading(false)
    if (!toastResult(result, 'Avoir émis avec succès')) return
    onDone?.(result.publicId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Fermer" onClick={onClose} />
      <Card className="relative w-full max-w-md p-6">
        <Text weight="bold">Créer un Avoir / Remboursement</Text>
        <Text size="sm" variant="muted" className="mt-1">
          Facture {invoiceCode} — maximum remboursable {formatCfa(maxAmount)}.
        </Text>
        <form onSubmit={handleSubmit} className="mt-2">
          <InputField
            id="credit-amount"
            name="amount"
            label="Montant à rembourser (F CFA)"
            type="number"
            min={1}
            max={Math.max(maxAmount, 1)}
            defaultValue={maxAmount > 0 ? maxAmount : undefined}
            required
          />
          <label className="mt-2.5 mb-1 block font-sans text-sm font-bold" htmlFor="credit-reason">
            Motif
          </label>
          <select id="credit-reason" name="reason" required defaultValue="" className={controlClass}>
            <option value="" disabled>
              Sélectionner un motif
            </option>
            {CREDIT_NOTE_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" name="restock" className="mt-1 h-4 w-4 accent-primary" />
            <span>
              <span className="font-bold">Réintégrer les articles en stock</span>
              <Caption className="block">Crée un mouvement d’entrée pour les lignes de la facture.</Caption>
            </span>
          </label>
          <div className="mt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Fermer
            </Button>
            <Button type="submit" className="flex-1" isLoading={loading} disabled={maxAmount <= 0}>
              Enregistrer l’avoir
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export function CreditNoteBadge({
  count,
  href,
}: {
  count: number
  href?: string
}) {
  if (count <= 0) return null
  const label = count > 1 ? `Avoirs émis (${count})` : 'Avoir émis'
  const className =
    'inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-bold text-orange-800'
  if (href) {
    return (
      <a href={href} className={className}>
        {label}
      </a>
    )
  }
  return <span className={className}>{label}</span>
}
