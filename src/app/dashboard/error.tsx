'use client'

import { useEffect } from 'react'
import { AppErrorState } from '@/components/feedback/app-error-state'

type DashboardErrorProps = {
  error: Error & { digest?: string }
  reset?: () => void
  retry?: () => void
}

export default function DashboardError({ error, reset, retry }: DashboardErrorProps) {
  const recover = () => {
    if (reset) {
      reset()
      return
    }
    retry?.()
  }

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <AppErrorState
      variant="failure"
      code="Erreur"
      title="Une erreur inattendue est survenue"
      message="La page n’a pas pu s’afficher, souvent à cause d’un incident réseau ou d’une panne temporaire. Vous pouvez réessayer, ou revenir à l’accueil pour continuer."
      hint={error.digest ? `Réf. ${error.digest}` : undefined}
      className="min-h-[min(32rem,calc(100vh-8rem))] py-6"
      actions={[
        { label: 'Réessayer', onClick: recover },
        { label: 'Retour à l’accueil', href: '/dashboard', variant: 'outline' },
      ]}
    />
  )
}
