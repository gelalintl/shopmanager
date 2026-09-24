'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  CreditNotePrintTemplate,
  type CreditNotePrintFormat,
} from '@/components/invoices/credit-note-print-template'
import type { CreditNotePrint } from '@/lib/credit-notes'

type CreditNotePrintViewProps = {
  note: CreditNotePrint
  format: CreditNotePrintFormat
  autoPrint?: boolean
  backHref?: string
}

const FORMATS: CreditNotePrintFormat[] = ['ticket', 'a5', 'a4']

export function CreditNotePrintView({
  note,
  format,
  autoPrint = false,
  backHref,
}: CreditNotePrintViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const back = backHref ?? `/dashboard/invoices/${note.estimationPublicId}`

  useEffect(() => {
    if (!autoPrint) return
    const timer = window.setTimeout(() => window.print(), 300)
    return () => window.clearTimeout(timer)
  }, [autoPrint])

  function setFormat(next: CreditNotePrintFormat) {
    router.replace(`${pathname}?format=${next}`)
  }

  return (
    <div className="print-container fixed inset-0 z-50 overflow-auto bg-powder print:static print:bg-white">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-subtle-border bg-white px-4 py-3">
        <Link href={back}>
          <Button variant="outline">Retour</Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {FORMATS.map((item) => (
            <Button
              key={item}
              variant={item === format ? 'solid' : 'outline'}
              size="sm"
              onClick={() => setFormat(item)}
            >
              {item.toUpperCase()}
            </Button>
          ))}
          <Button onClick={() => window.print()}>Imprimer / PDF</Button>
        </div>
      </div>
      <div className="flex flex-col items-center py-6 print:py-0">
        <CreditNotePrintTemplate note={note} format={format} />
      </div>
    </div>
  )
}
