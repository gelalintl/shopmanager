'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PosTicketTemplate, type PosTicketFormat } from '@/components/pos/pos-ticket-template'
import { PrintCutLine } from '@/components/print/company-brand'
import type { PosTicket } from '@/app/dashboard/pos/types'

type PosTicketViewProps = {
  ticket: PosTicket
  format: PosTicketFormat
  autoPrint?: boolean
}

const FORMATS: PosTicketFormat[] = ['ticket', 'a5', 'a4']

export function PosTicketView({ ticket, format, autoPrint = false }: PosTicketViewProps) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!autoPrint) return
    const timer = window.setTimeout(() => window.print(), 300)
    return () => window.clearTimeout(timer)
  }, [autoPrint])

  function setFormat(next: PosTicketFormat) {
    router.replace(`${pathname}?format=${next}`)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-powder print:static print:bg-white">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-subtle-border bg-white px-4 py-3">
        <Link href="/dashboard/pos">
          <Button variant="outline">Retour à la caisse</Button>
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
        <PosTicketTemplate ticket={ticket} format={format} copy="client" />
        <PrintCutLine />
        <PosTicketTemplate ticket={ticket} format={format} copy="shop" />
      </div>
    </div>
  )
}
