import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar'
import { ProductProvider } from '@/context/product-context'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProductProvider>
      <div className="flex min-h-screen bg-powder">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 px-4 py-6 sm:px-6 print:p-0">{children}</main>
        </div>
      </div>
    </ProductProvider>
  )
}
