'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/typography'
import { cancelEstimation } from '@/app/dashboard/invoices/actions'
import { toastResult } from '@/lib/notify'

type QuoteCancelModalProps = {
  open: boolean
  estimationPublicId: string
  code: string
  onClose: () => void
  onDone?: () => void
}

export function QuoteCancelModal({
  open,
  estimationPublicId,
  code,
  onClose,
  onDone,
}: QuoteCancelModalProps) {
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const reason = String(form.get('reason') ?? '').trim()
    setLoading(true)
    const result = await cancelEstimation({
      estimationPublicId,
      reason: reason || undefined,
    })
    setLoading(false)
    if (!toastResult(result, 'Devis / proforma annulé.')) return
    onDone?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Fermer" onClick={onClose} />
      <Card className="relative w-full max-w-md p-6">
        <Text weight="bold">Annuler le devis / proforma</Text>
        <Text size="sm" variant="muted" className="mt-1">
          {code} sera passé au statut Annulé, sans conversion en facture. Le motif est facultatif.
        </Text>
        <form onSubmit={handleSubmit} className="mt-3">
          <label className="mt-2.5 mb-1 block font-sans text-sm font-bold" htmlFor="quote-cancel-reason">
            Motif (optionnel)
          </label>
          <textarea
            id="quote-cancel-reason"
            name="reason"
            rows={4}
            placeholder="Ex. : client a changé d’avis, erreur de saisie…"
            className="w-full rounded-md border border-subtle-border bg-white px-3 py-2 font-sans text-base focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="mt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Fermer
            </Button>
            <Button type="submit" variant="danger" className="flex-1" isLoading={loading}>
              Annuler le devis
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
