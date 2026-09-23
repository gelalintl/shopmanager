'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { InvoicePrintTemplate } from '@/components/invoices/invoice-print-template'
import { DeliveryNoteTemplate } from '@/components/invoices/delivery-note-template'
import type { LoadedInvoiceDocument } from '@/lib/invoice-document'
import { formatFrDate, isProformaStatus } from '@/lib/invoices'

type InvoicePrintViewProps = {
  document: LoadedInvoiceDocument
  autoPrint?: boolean
  sheet?: 'a4' | 'a5'
}

export function InvoicePrintView({ document, autoPrint = false, sheet = 'a4' }: InvoicePrintViewProps) {
  useEffect(() => {
    if (!autoPrint) return
    const timer = window.setTimeout(() => window.print(), 300)
    return () => window.clearTimeout(timer)
  }, [autoPrint])

  const dateLabel = `Niamey, le ${formatFrDate(document.issueDate ?? document.createdAt)}`
  const shared = {
    kind: document.kind,
    status: document.status,
    code: document.code,
    dateLabel,
    company: document.company,
    customer: document.customer,
    lines: document.lines,
    totals: document.totals,
    warranty: document.warranty,
    settings: document.settings,
    paidAmount: document.paidAmount,
    notes: document.notes,
    validityDays: document.kind === 'ESTIMATION' ? document.validityDays : undefined,
    validUntil: document.kind === 'ESTIMATION' ? document.validUntil : null,
    sheet,
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-powder print:static print:bg-white">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-subtle-border bg-white px-4 py-3">
        <Link href={`/dashboard/invoices/${document.estimationPublicId}`}>
          <Button variant="outline">Retour</Button>
        </Link>
        <Button onClick={() => window.print()}>
          {document.kind === 'INVOICE'
            ? 'Imprimer / PDF'
            : isProformaStatus(document.status)
              ? 'Imprimer la proforma / PDF'
              : 'Imprimer le devis / PDF'}
        </Button>
      </div>
      <div className="flex flex-col items-center gap-6 py-6 print:gap-0 print:py-0">
        {document.kind === 'INVOICE' ? (
          <>
            <InvoicePrintTemplate {...shared} copyLabel="EXEMPLAIRE CLIENT" className="print-page" />
            <InvoicePrintTemplate
              {...shared}
              copyLabel="EXEMPLAIRE ARCHIVE / SOUCHE"
              className="print-page"
            />
            <DeliveryNoteTemplate
              invoiceCode={document.code}
              dateLabel={dateLabel}
              company={document.company}
              customer={document.customer}
              lines={document.lines}
              settings={document.settings}
            />
          </>
        ) : (
          <InvoicePrintTemplate {...shared} className="print-page" />
        )}
      </div>
    </div>
  )
}
