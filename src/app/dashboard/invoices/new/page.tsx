import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { InvoiceBuilder } from '@/components/invoices/invoice-builder'
import { parsePrintSettings, type CatalogCustomer, type DocumentKind, type PrintCompany } from '@/lib/invoices'
import { toPrintCompany } from '@/lib/settings'

export const metadata: Metadata = {
  title: 'SM | Nouveau document',
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; customer?: string }>
}) {
  const session = await auth()
  const companyId = session?.user?.companyId
  if (!companyId) redirect('/login')

  const { kind: kindParam, customer: customerParam } = await searchParams
  const kind: DocumentKind = kindParam === 'invoice' ? 'INVOICE' : 'ESTIMATION'

  const [company, customerRows] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.customer.findMany({
      where: { companyId, isDeleted: false },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!company) redirect('/login')

  const customers: CatalogCustomer[] = customerRows.map((item) => ({
    publicId: item.publicId,
    name: item.name,
    phone: item.phone,
    address: item.address,
    postBox: item.postBox,
    email: item.email,
    nif: item.nif,
    kind: item.kind,
  }))

  const printCompany: PrintCompany = toPrintCompany(company)

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <InvoiceBuilder
        kind={kind}
        customers={customers}
        company={printCompany}
        settings={parsePrintSettings(company.printSettings)}
        initialCustomerId={customerParam ?? ''}
      />
    </div>
  )
}
