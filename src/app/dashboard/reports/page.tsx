import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { requirePageRole } from '@/lib/rbac'
import { MANAGER_ROLES } from '@/lib/auth'
import { ReportsWorkspace } from '@/components/reports/reports-workspace'
import {
  getOutstandingReport,
  getProductSalesReport,
  getSalesReport,
  getVatReport,
} from '@/app/dashboard/reports/actions'
import { parseReportPreset, parseReportTab, rangeToInputs, reportRange } from '@/lib/analytics'
import { formatFrDate } from '@/lib/invoices'
import { Heading, Text } from '@/components/ui/typography'

export const metadata: Metadata = {
  title: 'SM | Rapports',
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    preset?: string
    startDate?: string
    endDate?: string
    tab?: string
  }>
}) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  await requirePageRole(MANAGER_ROLES)

  const params = await searchParams
  const preset = parseReportPreset(params.preset)
  const tab = parseReportTab(params.tab)
  const range = reportRange(preset, params.startDate, params.endDate)
  const { startDate, endDate } = rangeToInputs(range.start, range.end)

  const [sales, receivables, products, vat] = await Promise.all([
    getSalesReport(startDate, endDate, preset),
    getOutstandingReport(),
    getProductSalesReport(startDate, endDate, preset),
    getVatReport(startDate, endDate, preset),
  ])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <Heading as="h2" size="xl">
          Rapports & exports
        </Heading>
        <Text variant="muted" className="mt-1">
          Du {formatFrDate(startDate)} au {formatFrDate(endDate)}.
        </Text>
      </div>
      <Suspense fallback={null}>
        <ReportsWorkspace
          preset={preset}
          startDate={startDate}
          endDate={endDate}
          tab={tab}
          sales={sales}
          receivables={receivables}
          products={products}
          vat={vat}
        />
      </Suspense>
    </div>
  )
}
