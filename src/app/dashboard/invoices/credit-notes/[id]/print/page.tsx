import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { CreditNotePrintView } from '@/components/invoices/credit-note-print-view'
import { loadCreditNote } from '@/lib/credit-notes'
import type { CreditNotePrintFormat } from '@/components/invoices/credit-note-print-template'

export const metadata: Metadata = {
  title: 'SM | Reçu d’avoir',
}

function parseFormat(value?: string): CreditNotePrintFormat {
  if (value === 'a5' || value === 'a4' || value === 'ticket') return value
  return 'ticket'
}

export default async function CreditNotePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ format?: string; download?: string }>
}) {
  const session = await auth()
  const companyId = session?.user?.companyId
  if (!companyId) redirect('/login')

  const { id } = await params
  const query = await searchParams
  const note = await loadCreditNote(companyId, id)
  if (!note) notFound()

  return (
    <CreditNotePrintView
      note={note}
      format={parseFormat(query.format)}
      autoPrint={query.download === '1'}
    />
  )
}
