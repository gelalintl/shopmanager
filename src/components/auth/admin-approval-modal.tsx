'use client'

import { FormEvent, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Heading, Text } from '@/components/ui/typography'
import { InputField } from '@/components/ui/input'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import type { AdminProof } from '@/lib/auth'

type AdminApprovalModalProps = {
  open: boolean
  title: string
  description?: string
  requireReason?: boolean
  requirePassword?: boolean
  onClose: () => void
  onConfirm: (proof: AdminProof) => Promise<{ ok: true } | { ok: false; error: string }>
}

export function AdminApprovalModal({
  open,
  title,
  description,
  requireReason = false,
  requirePassword = false,
  onClose,
  onConfirm,
}: AdminApprovalModalProps) {
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const identifier = String(form.get('identifier') ?? '').trim()
    const password = String(form.get('password') ?? '').trim()
    const pin = String(form.get('pin') ?? '').trim()
    const reason = String(form.get('reason') ?? '').trim()
    if (requireReason && !reason) {
      toast.error('Le motif est obligatoire.')
      return
    }
    if (!identifier) {
      toast.error('Saisissez l’email d’un administrateur de votre entreprise.')
      return
    }
    if (requirePassword) {
      if (!password) {
        toast.error('Saisissez le mot de passe de l’administrateur.')
        return
      }
    } else if (!password && !pin) {
      toast.error('Saisissez le mot de passe ou le PIN administrateur.')
      return
    }
    setLoading(true)
    const result = await onConfirm({ identifier, password, pin, reason })
    setLoading(false)
    if (!result.ok) {
      toast.error(result.error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Fermer" onClick={onClose} />
      <Card className="relative w-full max-w-md p-6">
        <Heading as="h2" size="lg">
          {title}
        </Heading>
        <Text variant="muted" size="sm" className="mt-1">
          {description ??
            'Un administrateur de votre entreprise doit valider cette action. Les identifiants d’une autre société sont refusés.'}
        </Text>
        <form onSubmit={handleSubmit} className="mt-2">
          <InputField
            id="admin-identifier"
            name="identifier"
            label={requirePassword ? 'Email administrateur' : 'Email ou identifiant administrateur'}
            autoComplete="username"
            required
          />
          <InputField
            id="admin-password"
            name="password"
            label="Mot de passe administrateur"
            type="password"
            autoComplete="current-password"
            required={requirePassword}
          />
          {requirePassword ? null : (
            <InputField
              id="admin-pin"
              name="pin"
              label="PIN administrateur (si utilisé à la place du mot de passe)"
              type="password"
              inputMode="numeric"
              autoComplete="off"
            />
          )}
          {requireReason ? (
            <InputField id="admin-reason" name="reason" label="Motif" placeholder="Raison de l’annulation" required />
          ) : (
            <InputField id="admin-reason" name="reason" label="Motif (optionnel)" />
          )}
          <div className="mt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Fermer
            </Button>
            <Button type="submit" className="flex-1" isLoading={loading}>
              Valider et exécuter
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

type RestrictedRequest = {
  title: string
  description?: string
  requireReason?: boolean
  requirePassword?: boolean
  confirmLabel?: string
  variant?: 'solid' | 'danger'
  successMessage?: string
  run: (proof?: AdminProof | null) => Promise<{ ok: true } | { ok: false; error: string }>
}

export function useRestrictedAction() {
  const { data: session } = useSession()
  const isManager = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'
  const [request, setRequest] = useState<RestrictedRequest | null>(null)
  const { confirm, dialog } = useConfirmDialog()

  async function runRestricted(next: RestrictedRequest) {
    if (isManager) {
      const confirmed = await confirm({
        title: next.title,
        description: next.description,
        confirmLabel: next.confirmLabel ?? 'Confirmer',
        variant: next.variant ?? 'danger',
      })
      if (!confirmed) return
      const result = await next.run(null)
      if (result.ok) toast.success(next.successMessage ?? 'Opération réussie.')
      else toast.error(result.error)
      return
    }
    setRequest(next)
  }

  const modal = (
    <>
      {dialog}
      <AdminApprovalModal
        open={Boolean(request)}
        title={request?.title ?? ''}
        description={request?.description}
        requireReason={request?.requireReason}
        requirePassword={request?.requirePassword}
        onClose={() => setRequest(null)}
        onConfirm={async (proof) => {
          if (!request) return { ok: false, error: 'Action introuvable.' }
          const result = await request.run(proof)
          if (result.ok) {
            toast.success(request.successMessage ?? 'Opération réussie.')
            setRequest(null)
          }
          return result
        }}
      />
    </>
  )

  return { isManager, runRestricted, modal }
}
