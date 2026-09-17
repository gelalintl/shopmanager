import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { CustomerProfile } from '@/components/customers/customer-profile'
import { getCustomerDetails } from '@/app/dashboard/customers/actions'

export const metadata: Metadata = {
  title: 'SM | Fiche client',
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')

  const { id } = await params
  const customer = await getCustomerDetails(id)
  if (!customer) notFound()

  return (
    <div className="mx-auto w-full max-w-5xl">
      <CustomerProfile customer={customer} />
    </div>
  )
}
