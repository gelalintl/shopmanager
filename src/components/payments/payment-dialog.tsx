'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { InputField, controlClass } from '@/components/ui/input'
import { recordPayment } from '@/app/dashboard/payments/actions'
import { formatCfa } from '@/lib/invoices'
import { PAYMENT_METHODS, paymentMethodLabels } from '@/lib/payments'

type PaymentDialogProps = {
  open: boolean
  invoicePublicId: string
  invoiceCode: string
  remaining: number
  onClose: () => void
  onDone?: (collectionPublicId?: string) => void
}

export function PaymentDialog({
  open,
  invoicePublicId,
  invoiceCode,
  remaining,
  onClose,
  onDone,
}: PaymentDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setLoading(true)
    setError(null)
    const result = await recordPayment({
      invoicePublicId,
      amount: Number(form.get('amount')),
      paymentDate: String(form.get('paymentDate') || '') || undefined,
      note: String(form.get('note') || '') || undefined,
      paymentMethod: String(form.get('paymentMethod') || 'CASH'),
    })
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onDone?.(result.publicId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-slate-900/30" aria-label="Fermer" onClick={onClose} />
      <Card className="relative w-full max-w-md p-6">
        <Text weight="bold">Règlement {invoiceCode}</Text>
        <Text size="sm" variant="muted" className="mt-1">
          Reste à payer : {formatCfa(remaining)}
        </Text>
        <form onSubmit={handleSubmit} className="mt-2">
          {error ? (
            <Caption color="danger" className="italic">
              *{error}
            </Caption>
          ) : null}
          <InputField
            id="amount"
            name="amount"
            label="Montant"
            type="number"
            min={1}
            max={remaining}
            required
          />
          <label className="mt-2.5 mb-1 block font-sans text-sm font-bold" htmlFor="paymentMethod">
            Mode de paiement
          </label>
          <select id="paymentMethod" name="paymentMethod" defaultValue="CASH" className={controlClass}>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {paymentMethodLabels[method]}
              </option>
            ))}
          </select>
          <InputField id="paymentDate" name="paymentDate" label="Date" type="date" />
          <InputField id="note" name="note" label="Note" placeholder="Référence, chèque, opérateur…" />
          <div className="mt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" isLoading={loading}>
              Encaisser
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
