import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { InvoiceDetail } from '@/components/invoices/invoice-detail'
import { loadInvoiceDocument } from '@/lib/invoice-document'

export const metadata: Metadata = {
  title: 'SM | Document',
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const companyId = session?.user?.companyId
  if (!companyId) redirect('/login')

  const { id } = await params
  const document = await loadInvoiceDocument(companyId, id)
  if (!document) notFound()

  return (
    <div className="mx-auto w-full max-w-5xl">
      <InvoiceDetail {...document} />
    </div>
  )
}
