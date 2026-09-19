import type { Metadata } from 'next'
import { PT_Sans } from 'next/font/google'
import { SessionProvider } from '@/components/providers/session-provider'
import { AppToaster } from '@/components/ui/toaster'
import './globals.css'

const ptSans = PT_Sans({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pt-sans',
})

export const metadata: Metadata = {
  title: 'ShopManager',
  description: 'Gestion commerciale multi-tenant',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={ptSans.variable}>
      <body className={`${ptSans.className} antialiased`}>
        <SessionProvider>
          {children}
          <AppToaster />
        </SessionProvider>
      </body>
    </html>
  )
}