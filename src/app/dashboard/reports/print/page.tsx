import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ReportsPrintView } from '@/components/reports/reports-print-view'
import {
  getOutstandingReport,
  getProductSalesReport,
  getReportCompany,
  getSalesReport,
  getVatReport,
} from '@/app/dashboard/reports/actions'
import { parseReportPreset, rangeToInputs, reportRange } from '@/lib/analytics'
import { formatFrDate } from '@/lib/invoices'

export const metadata: Metadata = {
  title: 'SM | Synthèse financière',
}

export default async function ReportsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    preset?: string
    startDate?: string
    endDate?: string
    download?: string
  }>
}) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')

  const params = await searchParams
  const preset = parseReportPreset(params.preset)
  const range = reportRange(preset, params.startDate, params.endDate)
  const { startDate, endDate } = rangeToInputs(range.start, range.end)
  const periodQuery = new URLSearchParams({ preset, startDate, endDate })

  const [company, sales, receivables, products, vat] = await Promise.all([
    getReportCompany(),
    getSalesReport(startDate, endDate, preset),
    getOutstandingReport(),
    getProductSalesReport(startDate, endDate, preset),
    getVatReport(startDate, endDate, preset),
  ])
  if (!company) notFound()

  return (
    <ReportsPrintView
      company={company}
      periodLabel={`Du ${formatFrDate(startDate)} au ${formatFrDate(endDate)}`}
      generatedAt={formatFrDate(new Date())}
      sales={sales}
      receivables={receivables}
      products={products}
      vat={vat}
      backHref={`/dashboard/reports?${periodQuery.toString()}`}
      autoPrint={params.download === '1'}
    />
  )
}
