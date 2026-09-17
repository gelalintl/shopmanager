import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { PaymentReceiptView } from '@/components/payments/payment-receipt-view'
import { getPaymentReceipt } from '@/app/dashboard/payments/actions'

export const metadata: Metadata = {
  title: 'SM | Reçu',
}

export default async function PaymentReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ download?: string }>
}) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')

  const { id } = await params
  const { download } = await searchParams
  const receipt = await getPaymentReceipt(id)
  if (!receipt) notFound()

  return <PaymentReceiptView receipt={receipt} autoPrint={download === '1'} />
}
