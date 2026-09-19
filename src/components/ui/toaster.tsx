'use client'

import { Toaster as SonnerToaster } from 'sonner'

export function AppToaster() {
  return (
    <SonnerToaster
      richColors
      position="top-right"
      closeButton
      toastOptions={{
        className: 'font-sans',
      }}
    />
  )
}
