import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getPosTicket } from '@/app/dashboard/pos/actions'
import { PosTicketView } from '@/components/pos/pos-ticket-view'
import type { PosTicketFormat } from '@/components/pos/pos-ticket-template'

export const metadata: Metadata = {
  title: 'SM | Ticket de caisse',
}

function parseFormat(value?: string): PosTicketFormat {
  if (value === 'a5' || value === 'a4' || value === 'ticket') return value
  return 'ticket'
}

export default async function PosTicketPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ format?: string; download?: string }>
}) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')

  const { id } = await params
  const query = await searchParams
  const ticket = await getPosTicket(id)
  if (!ticket) notFound()

  return (
    <PosTicketView ticket={ticket} format={parseFormat(query.format)} autoPrint={query.download === '1'} />
  )
}
