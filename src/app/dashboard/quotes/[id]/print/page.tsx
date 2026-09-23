import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'SM | Impression proforma',
}

export default async function QuotePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ download?: string; format?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const qs = new URLSearchParams()
  if (query.download) qs.set('download', query.download)
  if (query.format) qs.set('format', query.format)
  const suffix = qs.toString()
  redirect(`/dashboard/invoices/${id}/print${suffix ? `?${suffix}` : ''}`)
}
