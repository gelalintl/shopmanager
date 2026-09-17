import { CompanyBrand } from '@/components/print/company-brand'
import { formatCfa, printAccentVars, type PrintCompany } from '@/lib/invoices'
import type { ProductSaleRow, ReceivableRow, SalesReport, VatRow } from '@/lib/analytics'
import { cn } from '@/lib/cn'

type ReportsPrintTemplateProps = {
  company: PrintCompany
  periodLabel: string
  generatedAt: string
  sales: SalesReport
  receivables: ReceivableRow[]
  products: ProductSaleRow[]
  vat: { rows: VatRow[]; ht: number; vat: number; ttc: number }
}

export function ReportsPrintTemplate({
  company,
  periodLabel,
  generatedAt,
  sales,
  receivables,
  products,
  vat,
}: ReportsPrintTemplateProps) {
  const topReceivables = receivables.slice(0, 10)
  const topProducts = products.slice(0, 10)

  return (
    <article
      className={cn(
        'invoice-print-sheet flex min-h-[297mm] w-[210mm] flex-col bg-white p-10 text-[12px] text-foreground shadow-sm',
      )}
      style={printAccentVars()}
    >
      <header
        className="flex items-start justify-between gap-6 border-b pb-4"
        style={{ borderColor: 'var(--print-accent)' }}
      >
        <div>
          <CompanyBrand name={company.name} logoPath={company.logoPath} />
          <div className="mt-3 space-y-0.5 text-foreground-muted">
            <p className="font-bold text-foreground">{company.name}</p>
            <p>{company.address}</p>
            {company.postBox ? <p>B.P. : {company.postBox}</p> : null}
            <p>Tél. : {company.phone1}</p>
            {company.email ? <p>{company.email}</p> : null}
            {company.nif ? <p>NIF : {company.nif}</p> : null}
            {company.rccm ? <p>RCCM : {company.rccm}</p> : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold tracking-[0.2em]" style={{ color: 'var(--print-accent)' }}>SYNTHÈSE FINANCIÈRE</p>
          <p className="mt-1 text-xl font-bold" style={{ color: 'var(--print-accent)' }}>Rapport d’activité</p>
          <p className="mt-2 text-foreground-muted">{periodLabel}</p>
          <p className="mt-1 text-foreground-muted">Édité le {generatedAt}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-4 gap-3">
        <Kpi label="CA facturé" value={formatCfa(sales.billed)} />
        <Kpi label="CA encaissé" value={formatCfa(sales.collected)} />
        <Kpi label="Factures" value={String(sales.invoiceCount)} />
        <Kpi label="TVA collectée" value={formatCfa(vat.vat)} />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold tracking-wide text-cobalt uppercase">Évolution facturé vs encaissé</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-soft-cobalt text-left">
              <th className="px-2 py-1.5 font-bold">Mois</th>
              <th className="px-2 py-1.5 text-right font-bold">Facturé</th>
              <th className="px-2 py-1.5 text-right font-bold">Encaissé</th>
            </tr>
          </thead>
          <tbody>
            {sales.history.map((point) => (
              <tr key={point.key} className="border-b border-subtle-border">
                <td className="px-2 py-1 capitalize">{point.label}</td>
                <td className="px-2 py-1 text-right">{formatCfa(point.billed)}</td>
                <td className="px-2 py-1 text-right">{formatCfa(point.collected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold tracking-wide text-cobalt uppercase">Créances clients</h2>
        {topReceivables.length === 0 ? (
          <p className="text-foreground-muted">Aucune créance ouverte.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-soft-cobalt text-left">
                <th className="px-2 py-1.5 font-bold">Client</th>
                <th className="px-2 py-1.5 text-right font-bold">Reste</th>
                <th className="px-2 py-1.5 text-right font-bold">Retard</th>
              </tr>
            </thead>
            <tbody>
              {topReceivables.map((row) => (
                <tr key={row.customerPublicId} className="border-b border-subtle-border">
                  <td className="px-2 py-1">{row.customerName}</td>
                  <td className="px-2 py-1 text-right">{formatCfa(row.remaining)}</td>
                  <td className="px-2 py-1 text-right">{formatCfa(row.overdueAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold tracking-wide text-cobalt uppercase">Ventes par produit</h2>
        {topProducts.length === 0 ? (
          <p className="text-foreground-muted">Aucune vente sur la période.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-soft-cobalt text-left">
                <th className="px-2 py-1.5 font-bold">Produit</th>
                <th className="px-2 py-1.5 text-right font-bold">Qté</th>
                <th className="px-2 py-1.5 text-right font-bold">CA TTC</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((row) => (
                <tr key={row.productId} className="border-b border-subtle-border">
                  <td className="px-2 py-1">
                    {row.designation}
                    <span className="ml-1 text-foreground-muted">({row.code})</span>
                  </td>
                  <td className="px-2 py-1 text-right">{row.quantity}</td>
                  <td className="px-2 py-1 text-right">{formatCfa(row.revenueTtc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 rounded-xl bg-soft-cobalt px-4 py-3">
        <h2 className="text-xs font-bold tracking-wide text-cobalt uppercase">TVA collectée</h2>
        <div className="mt-2 grid grid-cols-3 gap-3 font-bold">
          <p>Base HT : {formatCfa(vat.ht)}</p>
          <p>TVA : {formatCfa(vat.vat)}</p>
          <p>TTC : {formatCfa(vat.ttc)}</p>
        </div>
        <p className="mt-2 text-foreground-muted">
          {vat.rows.length} facture{vat.rows.length > 1 ? 's' : ''} · Conversion devis/factures{' '}
          {Math.round(sales.conversionRate * 100)} % · Remises {formatCfa(sales.discountTotal)}
        </p>
      </section>

      {company.legalMentions ? (
        <p className="mt-auto pt-6 text-[10px] text-foreground-muted">{company.legalMentions}</p>
      ) : (
        <p className="mt-auto pt-6 text-[10px] text-foreground-muted">
          Document généré par ShopManager — {company.name}
        </p>
      )}
    </article>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-soft-cobalt px-3 py-2">
      <p className="text-[10px] font-bold tracking-wide text-cobalt uppercase">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  )
}
