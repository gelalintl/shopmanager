import type { Metadata } from 'next'
import { AppErrorState } from '@/components/feedback/app-error-state'

export const metadata: Metadata = {
  title: 'SM | Page introuvable',
}

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-powder">
      <AppErrorState
        variant="missing"
        code="404"
        title="Page introuvable"
        message="Cette adresse n’existe pas, a été déplacée, ou n’est plus disponible. Vérifiez le lien ou revenez à votre espace de travail."
        actions={[{ label: 'Retour au tableau de bord', href: '/dashboard' }]}
      />
    </main>
  )
}
