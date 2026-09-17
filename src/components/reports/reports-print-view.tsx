'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ReportsPrintTemplate } from '@/components/reports/reports-print-template'
import type { PrintCompany } from '@/lib/invoices'
import type { ProductSaleRow, ReceivableRow, SalesReport, VatRow } from '@/lib/analytics'

type ReportsPrintViewProps = {
  company: PrintCompany
  periodLabel: string
  generatedAt: string
  sales: SalesReport
  receivables: ReceivableRow[]
  products: ProductSaleRow[]
  vat: { rows: VatRow[]; ht: number; vat: number; ttc: number }
  backHref: string
  autoPrint?: boolean
}

export function ReportsPrintView({
  company,
  periodLabel,
  generatedAt,
  sales,
  receivables,
  products,
  vat,
  backHref,
  autoPrint = false,
}: ReportsPrintViewProps) {
  useEffect(() => {
    if (!autoPrint) return
    const timer = window.setTimeout(() => window.print(), 300)
    return () => window.clearTimeout(timer)
  }, [autoPrint])

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-powder print:static print:bg-white">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-subtle-border bg-white px-4 py-3">
        <Link href={backHref}>
          <Button variant="outline">Retour</Button>
        </Link>
        <Button onClick={() => window.print()}>Imprimer / PDF</Button>
      </div>
      <div className="flex justify-center py-6 print:py-0">
        <ReportsPrintTemplate
          company={company}
          periodLabel={periodLabel}
          generatedAt={generatedAt}
          sales={sales}
          receivables={receivables}
          products={products}
          vat={vat}
        />
      </div>
    </div>
  )
}
