'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Heading, Text } from '@/components/ui/typography'

export type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'solid' | 'danger'
}

type ConfirmState = ConfirmOptions & {
  loading: boolean
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'solid',
  loading = false,
  onClose,
  onConfirm,
}: ConfirmOptions & {
  open: boolean
  loading?: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Fermer" onClick={onClose} />
      <Card className="relative w-full max-w-md p-6">
        <Heading as="h2" size="lg">
          {title}
        </Heading>
        {description ? (
          <Text variant="muted" size="sm" className="mt-2">
            {description}
          </Text>
        ) : null}
        <div className="mt-5 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={variant} className="flex-1" isLoading={loading} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  )
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null)
  const resolveRef = useRef<(value: boolean) => void>(undefined)

  function confirm(options: ConfirmOptions) {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setState({ ...options, loading: false })
    })
  }

  function close(value: boolean) {
    resolveRef.current?.(value)
    resolveRef.current = undefined
    setState(null)
  }

  const dialog = (
    <ConfirmDialog
      open={Boolean(state)}
      title={state?.title ?? ''}
      description={state?.description}
      confirmLabel={state?.confirmLabel}
      cancelLabel={state?.cancelLabel}
      variant={state?.variant}
      loading={state?.loading}
      onClose={() => close(false)}
      onConfirm={() => close(true)}
    />
  )

  return { confirm, dialog }
}
