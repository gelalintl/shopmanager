'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { InvoicePrintTemplate } from '@/components/invoices/invoice-print-template'
import type { LoadedInvoiceDocument } from '@/lib/invoice-document'
import { formatFrDate } from '@/lib/invoices'

type InvoicePrintViewProps = {
  document: LoadedInvoiceDocument
  autoPrint?: boolean
}

export function InvoicePrintView({ document, autoPrint = false }: InvoicePrintViewProps) {
  useEffect(() => {
    if (!autoPrint) return
    const timer = window.setTimeout(() => window.print(), 300)
    return () => window.clearTimeout(timer)
  }, [autoPrint])

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-powder print:static print:bg-white">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-subtle-border bg-white px-4 py-3">
        <Link href={`/dashboard/invoices/${document.estimationPublicId}`}>
          <Button variant="outline">Retour</Button>
        </Link>
        <Button onClick={() => window.print()}>Imprimer / PDF</Button>
      </div>
      <div className="flex justify-center py-6 print:py-0">
        <InvoicePrintTemplate
          kind={document.kind}
          code={document.code}
          dateLabel={`Niamey, le ${formatFrDate(document.issueDate ?? document.createdAt)}`}
          company={document.company}
          customer={document.customer}
          lines={document.lines}
          totals={document.totals}
          warranty={document.warranty}
          settings={document.settings}
          paidAmount={document.paidAmount}
          notes={document.notes}
          validityDays={document.kind === 'ESTIMATION' ? document.validityDays : undefined}
          validUntil={document.kind === 'ESTIMATION' ? document.validUntil : null}
        />
      </div>
    </div>
  )
}
