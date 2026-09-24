import type { CSSProperties } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar'
import { ProductProvider } from '@/context/product-context'
import { auth } from '@/auth'
import { getPrimaryColor } from '@/lib/site-settings'
import { DEFAULT_PRIMARY_COLOR } from '@/lib/invoices'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const companyId = session?.user?.companyId
  const stored = companyId ? await getPrimaryColor(companyId) : null
  const primaryColor = stored || DEFAULT_PRIMARY_COLOR

  return (
    <ProductProvider>
      <div
        style={{ '--primary-color': primaryColor || DEFAULT_PRIMARY_COLOR } as CSSProperties}
        className="flex min-h-screen bg-background"
        data-dashboard-shell
      >
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 px-4 py-6 sm:px-6 print:p-0">{children}</main>
        </div>
      </div>
    </ProductProvider>
  )
}
