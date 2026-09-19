import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { InvoicePrintView } from '@/components/invoices/invoice-print-view'
import { loadInvoiceDocument } from '@/lib/invoice-document'

export const metadata: Metadata = {
  title: 'SM | Impression',
}

export default async function InvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ download?: string; format?: string }>
}) {
  const session = await auth()
  const companyId = session?.user?.companyId
  if (!companyId) redirect('/login')

  const { id } = await params
  const { download, format } = await searchParams
  const document = await loadInvoiceDocument(companyId, id)
  if (!document) notFound()

  return (
    <InvoicePrintView
      document={document}
      autoPrint={download === '1'}
      sheet={format === 'a5' ? 'a5' : 'a4'}
    />
  )
}
