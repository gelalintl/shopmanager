'use client'

import { useEffect } from 'react'
import { PT_Sans } from 'next/font/google'
import { AppErrorState } from '@/components/feedback/app-error-state'
import './globals.css'

const ptSans = PT_Sans({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
})

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset?: () => void
  retry?: () => void
}

export default function GlobalError({ error, reset, retry }: GlobalErrorProps) {
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
    <html lang="fr">
      <body className={`${ptSans.className} antialiased`}>
        <title>SM | Incident</title>
        <main className="flex min-h-screen items-center justify-center bg-powder">
          <AppErrorState
            variant="failure"
            code="Erreur"
            title="Une erreur inattendue est survenue"
            message="L’application n’a pas pu démarrer correctement. Réessayez, ou revenez à l’accueil pour débloquer votre session."
            hint={error.digest ? `Réf. ${error.digest}` : undefined}
            actions={[
              { label: 'Réessayer', onClick: recover },
              { label: 'Retour à l’accueil', href: '/dashboard', variant: 'outline' },
            ]}
          />
        </main>
      </body>
    </html>
  )
}
