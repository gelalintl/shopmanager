import { CompanyBrand, PrintGeneratedBy } from '@/components/print/company-brand'
import { printAccentVars, type PrintCompany, type PrintCustomer, type PrintSettings } from '@/lib/invoices'
import { cn } from '@/lib/cn'

export type DeliveryLine = {
  designation: string
  quantity: number
}

type DeliveryNoteTemplateProps = {
  invoiceCode: string
  dateLabel: string
  company: PrintCompany
  customer: PrintCustomer | null
  lines: DeliveryLine[]
  settings?: Pick<PrintSettings, 'accentColor'>
  className?: string
}

export function DeliveryNoteTemplate({
  invoiceCode,
  dateLabel,
  company,
  customer,
  lines,
  settings,
  className,
}: DeliveryNoteTemplateProps) {
  const blCode = `BL-${invoiceCode}`

  return (
    <article
      className={cn(
        'invoice-print-sheet print-page flex min-h-[297mm] w-[210mm] flex-col bg-white p-10 text-[13px] text-foreground shadow-sm',
        className,
      )}
      style={printAccentVars(settings?.accentColor)}
    >
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
            <p>
              Tél. : {company.phone1}
              {company.phone2 ? ` / ${company.phone2}` : ''}
            </p>
            {company.email ? <p>{company.email}</p> : null}
            {company.nif ? <p>NIF : {company.nif}</p> : null}
            {company.rccm ? <p>RCCM : {company.rccm}</p> : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold tracking-[0.2em]" style={{ color: 'var(--print-accent)' }}>
            BON DE LIVRAISON
          </p>
          <p className="mt-1 text-xl font-bold" style={{ color: 'var(--print-accent)' }}>
            {blCode}
          </p>
          <p className="mt-2 text-foreground-muted">Facture {invoiceCode}</p>
          <p className="text-foreground-muted">{dateLabel}</p>
        </div>
      </header>

      <section className="mt-6 rounded-xl px-4 py-3" style={{ background: 'var(--print-accent-soft)' }}>
        <p className="text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--print-accent)' }}>
          Livrer à
        </p>
        {customer ? (
          <div className="mt-1 font-bold">
            <p>{customer.name}</p>
            {customer.phone ? <p>Tél. : {customer.phone}</p> : null}
            {customer.address ? <p>{customer.address}</p> : null}
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
            <th className="px-2 py-2 text-right">Quantité</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-2 py-6 text-center text-foreground-muted">
                Aucune ligne
              </td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr key={`${line.designation}-${index}`} className="border-b border-subtle-border/80">
                <td className="px-2 py-2">{line.designation}</td>
                <td className="px-2 py-2 text-right font-bold">{line.quantity}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p className="mt-6 text-sm text-foreground-muted">
        Document de livraison uniquement — aucun règlement n’y figure.
      </p>

      <div className="mt-auto grid grid-cols-2 gap-6 pt-12">
        <div className="min-h-36 rounded-xl border border-subtle-border p-4">
          <p className="text-xs font-bold tracking-wide text-cobalt uppercase">Nom & Signature Livreur</p>
          <p className="mt-16 border-t border-subtle-border pt-2 text-xs text-foreground-muted">Nom / Signature</p>
        </div>
        <div className="min-h-36 rounded-xl border border-subtle-border p-4">
          <p className="text-xs font-bold tracking-wide text-cobalt uppercase">
            Date, Cachet & Signature Client (Reçu conforme)
          </p>
          <p className="mt-3 text-xs text-foreground-muted">Date : ____ / ____ / ________</p>
          <p className="mt-10 border-t border-subtle-border pt-2 text-xs text-foreground-muted">
            Cachet & signature
          </p>
        </div>
      </div>

      <footer className="mt-6">
        <PrintGeneratedBy />
      </footer>
    </article>
  )
}
