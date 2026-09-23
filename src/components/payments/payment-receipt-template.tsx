import { CompanyBrand, PrintGeneratedBy } from '@/components/print/company-brand'
import { amountToLetters, formatCfa, formatFrDate, parsePrintSettings, printAccentVars } from '@/lib/invoices'
import { paymentMethodLabels, type PaymentReceipt } from '@/lib/payments'
import { cn } from '@/lib/cn'

type PaymentReceiptTemplateProps = {
  receipt: PaymentReceipt
  className?: string
}

export function PaymentReceiptTemplate({ receipt, className }: PaymentReceiptTemplateProps) {
  const settings = parsePrintSettings(receipt.printSettings)
  const footerText = settings.footerText.trim()
  const bankLine = [receipt.companyBankName, receipt.companyBankAccountName].filter(Boolean).join(' · ')

  return (
    <article
      className={cn(
        'receipt-print-sheet flex min-h-[210mm] w-[148mm] flex-col bg-white p-8 text-[13px] text-foreground shadow-sm',
        className,
      )}
      style={printAccentVars(settings.accentColor)}
    >
      <header
        className="flex items-start justify-between gap-4 border-b pb-4"
        style={{ borderColor: 'var(--print-accent)' }}
      >
        {receipt.companyLogoPath ? (
          <CompanyBrand name={receipt.companyName} logoPath={receipt.companyLogoPath} />
        ) : null}
        <div className={receipt.companyLogoPath ? 'text-right' : 'ml-auto text-right'}>
          <p className="text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--print-accent)' }}>
            Reçu d’encaissement
          </p>
          <p className="mt-1 text-lg font-bold">{receipt.receiptNumber}</p>
        </div>
      </header>

      <section className="mt-5 space-y-1">
        <p className="text-base font-bold">{receipt.companyName}</p>
        {receipt.companySlogan ? <p className="italic text-foreground-muted">{receipt.companySlogan}</p> : null}
        <p>{receipt.companyAddress}</p>
        <p>Tél. {receipt.companyPhone}</p>
        {receipt.companyNif ? <p>NIF {receipt.companyNif}</p> : null}
        {receipt.companyRccm ? <p>RCCM {receipt.companyRccm}</p> : null}
      </section>

      <section className="mt-6 rounded-xl border border-subtle-border p-4" style={{ background: 'var(--print-accent-soft)' }}>
        <p className="text-xs font-bold tracking-wide text-foreground-muted uppercase">Reçu de</p>
        <p className="mt-1 text-base font-bold">{receipt.customerName}</p>
        {receipt.customerAddress ? <p>{receipt.customerAddress}</p> : null}
        {receipt.customerPhone ? <p>Tél. {receipt.customerPhone}</p> : null}
      </section>

      <dl className="mt-6 space-y-3">
        <div className="flex justify-between gap-4 border-b border-subtle-border pb-2">
          <dt className="text-foreground-muted">Facture</dt>
          <dd className="font-bold">{receipt.invoiceCode}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-subtle-border pb-2">
          <dt className="text-foreground-muted">Date</dt>
          <dd>{formatFrDate(receipt.paymentDate)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-subtle-border pb-2">
          <dt className="text-foreground-muted">Mode de paiement</dt>
          <dd className="font-bold">{paymentMethodLabels[receipt.paymentMethod]}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-subtle-border pb-2">
          <dt className="text-foreground-muted">Montant réglé ce jour</dt>
          <dd className="text-lg font-bold" style={{ color: 'var(--print-accent)' }}>{formatCfa(receipt.amount)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-foreground-muted">Reste à payer</dt>
          <dd className="font-bold">{formatCfa(receipt.remainingAfter)}</dd>
        </div>
      </dl>

      {receipt.note ? (
        <p className="mt-4 text-foreground-muted">Note : {receipt.note}</p>
      ) : null}

      <p className="mt-6 text-sm">
        Arrêté le présent reçu à la somme de :{' '}
        <span className="font-bold">{amountToLetters(receipt.amount)}</span>.
      </p>

      {settings.showRib && (receipt.companyRib || bankLine) ? (
        <div className="mt-4 text-xs text-foreground-muted">
          {bankLine ? <p>Banque : {bankLine}</p> : null}
          {receipt.companyRib ? <p>RIB : {receipt.companyRib}</p> : null}
        </div>
      ) : null}

      <div className="mt-auto grid grid-cols-2 gap-6 pt-10 text-sm">
        <div>
          <p className="text-foreground-muted">Le client</p>
          <p className="mt-10 border-t border-subtle-border pt-2">Signature</p>
        </div>
        <div className="text-right">
          <p className="text-foreground-muted">Pour {receipt.companyName}</p>
          <p className="mt-1 text-xs">{receipt.collectorName}</p>
          <p className="mt-10 border-t border-subtle-border pt-2">Signature / Cachet</p>
        </div>
      </div>

      <footer className="mt-6 space-y-1 text-[10px] text-foreground-muted">
        {settings.showLegalMentions && receipt.companyLegalMentions ? <p>{receipt.companyLegalMentions}</p> : null}
        {footerText ? <p>{footerText}</p> : null}
        <PrintGeneratedBy />
      </footer>
    </article>
  )
}
