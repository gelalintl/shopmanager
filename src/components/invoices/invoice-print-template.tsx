import { CompanyBrand, PrintCopyBadge, PrintGeneratedBy } from '@/components/print/company-brand'
import {
  amountToLetters,
  formatCfa,
  formatFrDate,
  printAccentVars,
  TVA_RATE,
  type DocumentKind,
  type DocumentTotals,
  type PrintCompany,
  type PrintCustomer,
  type PrintSettings,
  defaultPrintSettings,
} from '@/lib/invoices'
import { cn } from '@/lib/cn'

export type { PrintCompany, PrintCustomer }

export type PrintLine = {
  designation: string
  quantity: number
  unitPrice: number
  discountRate: number
  ht: number
}

type InvoicePrintTemplateProps = {
  kind: DocumentKind
  code: string
  dateLabel: string
  company: PrintCompany
  customer: PrintCustomer | null
  lines: PrintLine[]
  totals: DocumentTotals
  warranty: number
  settings?: PrintSettings
  paidAmount?: number
  notes?: string | null
  className?: string
  validityDays?: number
  validUntil?: string | Date | null
  copyLabel?: string | null
  sheet?: 'a4' | 'a5'
}

export function InvoicePrintTemplate({
  kind,
  code,
  dateLabel,
  company,
  customer,
  lines,
  totals,
  warranty,
  settings = defaultPrintSettings,
  paidAmount = 0,
  notes,
  className,
  validityDays = 30,
  validUntil,
  copyLabel,
  sheet = 'a4',
}: InvoicePrintTemplateProps) {
  const title = kind === 'INVOICE' ? 'FACTURE' : 'DEVIS'
  const decree = kind === 'INVOICE' ? 'La présente facture est arrêtée' : 'Le présent devis est arrêté'
  const remaining = Math.max(totals.ttc - paidAmount, 0)
  const hasDiscounts = totals.globalDiscount > 0 || lines.some((line) => (line.discountRate || 0) > 0)
  const columnCount =
    1 +
    (settings.showQuantity ? 1 : 0) +
    (settings.showUnitPrice ? 1 : 0) +
    (hasDiscounts ? 1 : 0) +
    (settings.showLineTotal ? 1 : 0)
  const validityLabel = validUntil
    ? `Offre valable jusqu’au ${formatFrDate(validUntil)} (${validityDays} jour${validityDays > 1 ? 's' : ''})`
    : null
  const paymentTerms = settings.defaultPaymentTerms.trim()
  const footerText = settings.footerText.trim()
  const bankLine = [company.bankName, company.bankAccountName].filter(Boolean).join(' · ')

  return (
    <article
      className={cn(
        'invoice-print-sheet flex flex-col bg-white p-10 text-[13px] text-foreground shadow-sm',
        sheet === 'a5'
          ? 'invoice-print-sheet--a5 min-h-[210mm] w-[148mm]'
          : 'min-h-[297mm] w-[210mm]',
        className,
      )}
      style={printAccentVars(settings.accentColor)}
    >
      {copyLabel ? (
        <div className="mb-4 flex justify-end">
          <PrintCopyBadge label={copyLabel} />
        </div>
      ) : null}
      <header
        className="flex items-start justify-between gap-6 border-b pb-4"
        style={{ borderColor: 'var(--print-accent)' }}
      >
        <div>
          <CompanyBrand name={company.name} logoPath={company.logoPath} logoUrl={company.logoUrl} />
          <div className="mt-3 space-y-0.5 text-foreground-muted">
            <p className="font-bold text-foreground">{company.name}</p>
            {company.slogan ? <p className="italic">{company.slogan}</p> : null}
            <p>{company.address}</p>
            {company.postBox ? <p>B.P. : {company.postBox}</p> : null}
            <p>Tél. : {company.phone1}{company.phone2 ? ` / ${company.phone2}` : ''}</p>
            {company.email ? <p>{company.email}</p> : null}
            {company.nif ? <p>NIF : {company.nif}</p> : null}
            {company.rccm ? <p>RCCM : {company.rccm}</p> : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold tracking-[0.2em]" style={{ color: 'var(--print-accent)' }}>
            {title}
          </p>
          <p className="mt-1 text-xl font-bold" style={{ color: 'var(--print-accent)' }}>
            {code}
          </p>
          <p className="mt-2 text-foreground-muted">{dateLabel}</p>
          {kind === 'ESTIMATION' && validityLabel ? (
            <p className="mt-2 text-xs font-bold" style={{ color: 'var(--print-accent)' }}>
              {validityLabel}
            </p>
          ) : null}
        </div>
      </header>

      <section
        className="mt-6 rounded-xl px-4 py-3"
        style={{ background: 'var(--print-accent-soft)' }}
      >
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--print-accent)' }}>
          Adressé à
        </p>
        {customer ? (
          <div className="mt-1 font-bold">
            <p>{customer.name}</p>
            {customer.phone ? <p>Tél. : {customer.phone}</p> : null}
            <p>{customer.address}</p>
            {customer.postBox ? <p>B.P. : {customer.postBox}</p> : null}
            {customer.nif ? <p>NIF : {customer.nif}</p> : null}
          </div>
        ) : (
          <p className="mt-1 text-foreground-muted">Aucun client sélectionné</p>
        )}
      </section>

      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr className="border-b border-subtle-border bg-powder text-left">
            <th className="px-2 py-2">Désignation</th>
            {settings.showQuantity ? <th className="px-2 py-2 text-right">Qté</th> : null}
            {settings.showUnitPrice ? <th className="px-2 py-2 text-right">P.U.</th> : null}
            {hasDiscounts ? <th className="px-2 py-2 text-right">Remise</th> : null}
            {settings.showLineTotal ? <th className="px-2 py-2 text-right">Montant HT</th> : null}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="px-2 py-6 text-center text-foreground-muted">
                Aucune ligne
              </td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr key={`${line.designation}-${index}`} className="border-b border-subtle-border/80">
                <td className="px-2 py-2">{line.designation}</td>
                {settings.showQuantity ? <td className="px-2 py-2 text-right">{line.quantity}</td> : null}
                {settings.showUnitPrice ? (
                  <td className="px-2 py-2 text-right">{formatCfa(line.unitPrice)}</td>
                ) : null}
                {hasDiscounts ? (
                  <td className="px-2 py-2 text-right">{line.discountRate ? `${line.discountRate} %` : '—'}</td>
                ) : null}
                {settings.showLineTotal ? (
                  <td className="px-2 py-2 text-right font-bold">{formatCfa(line.ht)}</td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <section className="mt-6 ml-auto w-64 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>TOTAL HT</span>
          <span>{formatCfa(totals.linesHt)}</span>
        </div>
        {totals.globalDiscount > 0 ? (
          <>
            <div className="flex justify-between text-foreground-muted">
              <span>Remise globale</span>
              <span>- {formatCfa(totals.globalDiscount)}</span>
            </div>
            <div className="flex justify-between">
              <span>HT net</span>
              <span>{formatCfa(totals.ht)}</span>
            </div>
          </>
        ) : null}
        {totals.vat > 0 ? (
          <div className="flex justify-between">
            <span>TVA ({Math.round(TVA_RATE * 100)} %)</span>
            <span>{formatCfa(totals.vat)}</span>
          </div>
        ) : null}
        <div
          className="flex justify-between border-t pt-2 text-base font-bold"
          style={{ borderColor: 'var(--print-accent)', color: 'var(--print-accent)' }}
        >
          <span>TOTAL TTC</span>
          <span>{formatCfa(totals.ttc)}</span>
        </div>
        {kind === 'INVOICE' && paidAmount > 0 ? (
          <>
            <div className="flex justify-between">
              <span>Payé</span>
              <span>{formatCfa(paidAmount)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Reste à payer</span>
              <span>{formatCfa(remaining)}</span>
            </div>
          </>
        ) : null}
      </section>

      <p className="mt-6 text-sm">
        {decree} à la somme de :{' '}
        <span className="font-bold">{amountToLetters(totals.ttc)}</span>.
      </p>

      {notes ? <p className="mt-3 text-foreground-muted">{notes}</p> : null}
      {paymentTerms ? <p className="mt-3 text-foreground-muted">{paymentTerms}</p> : null}

      <footer className="mt-auto space-y-3 pt-8 text-xs text-foreground-muted">
        <div>
          <p>Délai de livraison : disponible dans la limite du stock</p>
          {kind === 'ESTIMATION' && validityLabel ? <p>{validityLabel}</p> : null}
          {settings.showWarranty && warranty > 0 ? <p>Durée de la garantie : {warranty} mois</p> : null}
        </div>
        {settings.showRib && (company.rib || bankLine) ? (
          <div>
            {bankLine ? (
              <p>
                <span className="font-bold text-foreground">Banque :</span> {bankLine}
              </p>
            ) : null}
            {company.rib ? (
              <p>
                <span className="font-bold text-foreground">RIB :</span> {company.rib}
              </p>
            ) : null}
          </div>
        ) : null}
        {settings.showLegalMentions && company.legalMentions ? <p>{company.legalMentions}</p> : null}
        {footerText ? <p>{footerText}</p> : null}
        {copyLabel ? (
          <div className="pt-2">
            <PrintCopyBadge label={copyLabel} />
          </div>
        ) : null}
        <PrintGeneratedBy className="pt-2" />
      </footer>
    </article>
  )
}
