'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { requestInvoiceCancellation } from '@/app/dashboard/invoices/actions'
import { toast } from 'sonner'

type CancellationRequestModalProps = {
  open: boolean
  invoicePublicId: string
  invoiceCode: string
  onClose: () => void
  onDone?: () => void
}

export function CancellationRequestModal({
  open,
  invoicePublicId,
  invoiceCode,
  onClose,
  onDone,
}: CancellationRequestModalProps) {
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const reason = String(form.get('reason') ?? '').trim()
    setLoading(true)
    const result = await requestInvoiceCancellation(invoicePublicId, reason)
    setLoading(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.warning('Demande d’annulation transmise')
    onDone?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Fermer" onClick={onClose} />
      <Card className="relative w-full max-w-md p-6">
        <Text weight="bold">Demander l’annulation</Text>
        <Text size="sm" variant="muted" className="mt-1">
          Facture {invoiceCode}. Un administrateur validera ou rejettera cette demande. Le stock n’est pas modifié pour l’instant.
        </Text>
        <form onSubmit={handleSubmit} className="mt-3">
          <label className="mt-2.5 mb-1 block font-sans text-sm font-bold" htmlFor="cancel-reason">
            Motif
          </label>
          <textarea
            id="cancel-reason"
            name="reason"
            required
            rows={4}
            placeholder="Ex. : erreur de saisie, doublon, client a changé d’avis…"
            className="w-full rounded-md border border-subtle-border bg-white px-3 py-2 font-sans text-base focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="mt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Fermer
            </Button>
            <Button type="submit" variant="danger" className="flex-1" isLoading={loading}>
              Envoyer la demande
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export function CancellationRequestBadge({
  reason,
  compact = false,
}: {
  reason?: string | null
  compact?: boolean
}) {
  return (
    <span
      className="inline-flex max-w-full flex-col items-start gap-0.5"
      title={reason || 'Demande d’annulation'}
    >
      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-800">
        Demande d’annulation
      </span>
      {!compact && reason ? (
        <Caption className="block max-w-[12rem] truncate text-red-700">{reason}</Caption>
      ) : null}
    </span>
  )
}
