'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PaymentReceiptTemplate } from '@/components/payments/payment-receipt-template'
import type { PaymentReceipt } from '@/lib/payments'

type PaymentReceiptViewProps = {
  receipt: PaymentReceipt
  autoPrint?: boolean
}

export function PaymentReceiptView({ receipt, autoPrint = false }: PaymentReceiptViewProps) {
  useEffect(() => {
    if (!autoPrint) return
    const timer = window.setTimeout(() => window.print(), 300)
    return () => window.clearTimeout(timer)
  }, [autoPrint])

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-powder print:static print:bg-white">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-subtle-border bg-white px-4 py-3">
        <Link href="/dashboard/payments">
          <Button variant="outline">Retour</Button>
        </Link>
        <Button onClick={() => window.print()}>Imprimer / PDF</Button>
      </div>
      <div className="flex justify-center py-6 print:py-0">
        <PaymentReceiptTemplate receipt={receipt} />
      </div>
    </div>
  )
}
