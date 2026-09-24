'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { ReportsFilters } from '@/components/reports/reports-filters'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { SummaryCards } from '@/components/dashboard/stats-card'
import { downloadCsv } from '@/lib/csv'
import { formatCfa, formatFrDate } from '@/lib/invoices'
import { rangeToInputs, reportRange, type ProductSaleRow, type ReceivableRow, type ReportPreset, type ReportTab, type SalesReport, type VatRow } from '@/lib/analytics'
import { cn } from '@/lib/cn'

const tabs: { id: ReportTab; label: string }[] = [
  { id: 'sales', label: '📊 Synthèse commerciale' },
  { id: 'receivables', label: '👥 Créances clients' },
  { id: 'products', label: '📦 Ventes par produit' },
  { id: 'vat', label: '🏛️ TVA collectée' },
]

type ReportsWorkspaceProps = {
  preset: ReportPreset
  startDate: string
  endDate: string
  tab: ReportTab
  sales: SalesReport
  receivables: ReceivableRow[]
  products: ProductSaleRow[]
  vat: { rows: VatRow[]; ht: number; vat: number; ttc: number }
}

export function ReportsWorkspace({
  preset,
  startDate,
  endDate,
  tab,
  sales,
  receivables,
  products,
  vat,
}: ReportsWorkspaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const replaceParams = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  function handleFilters(next: { preset: ReportPreset; startDate: string; endDate: string }) {
    if (next.preset === 'custom') {
      replaceParams({
        preset: 'custom',
        startDate: next.startDate,
        endDate: next.endDate,
      })
      return
    }
    const range = reportRange(next.preset)
    const inputs = rangeToInputs(range.start, range.end)
    replaceParams({
      preset: next.preset === 'month' ? '' : next.preset,
      startDate: inputs.startDate,
      endDate: inputs.endDate,
    })
  }

  function exportCsv() {
    if (tab === 'sales') {
      downloadCsv(
        'synthese-commerciale.csv',
        ['Indicateur', 'Valeur'],
        [
          ['CA facturé', sales.billed],
          ['CA encaissé', sales.collected],
          ['Nb factures', sales.invoiceCount],
          ['Nb devis', sales.estimationCount],
          ['Taux de conversion', `${Math.round(sales.conversionRate * 100)} %`],
          ['Remises', sales.discountTotal],
        ],
      )
      return
    }
    if (tab === 'receivables') {
      downloadCsv(
        'creances-clients.csv',
        ['Client', 'Factures', 'Facturé', 'Encaissé', 'Reste', 'Retard', 'Plus ancienne échéance'],
        receivables.map((row) => [
          row.customerName,
          row.invoiceCount,
          row.billed,
          row.collected,
          row.remaining,
          row.overdueAmount,
          row.oldestDueDate ? formatFrDate(row.oldestDueDate) : '',
        ]),
      )
      return
    }
    if (tab === 'products') {
      downloadCsv(
        'ventes-produits.csv',
        ['Code', 'Désignation', 'Quantité', 'CA HT', 'CA TTC'],
        products.map((row) => [row.code, row.designation, row.quantity, Math.round(row.revenueHt), Math.round(row.revenueTtc)]),
      )
      return
    }
    downloadCsv(
      'tva-collectee.csv',
      ['Facture', 'Client', 'Date', 'HT', 'TVA', 'TTC'],
      vat.rows.map((row) => [row.code, row.customerName, formatFrDate(row.date), row.ht, row.vat, row.ttc]),
    )
  }

  const printHref = `/dashboard/reports/print?preset=${preset}&startDate=${startDate}&endDate=${endDate}&download=1`

  return (
    <section className="flex flex-col gap-4">
      <ReportsFilters
        preset={preset}
        startDate={startDate}
        endDate={endDate}
        onChange={handleFilters}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => replaceParams({ tab: item.id === 'sales' ? '' : item.id })}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-bold transition-all duration-200',
                tab === item.id
                  ? 'border-primary bg-primary text-white'
                  : 'border-subtle-border bg-white text-foreground hover:border-primary hover:text-primary',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv}>
            Exporter CSV / Excel
          </Button>
          <Button onClick={() => window.open(printHref, '_blank', 'noopener,noreferrer')}>
            Télécharger la synthèse (PDF)
          </Button>
        </div>
      </div>

      {tab === 'sales' ? <SalesPanel sales={sales} /> : null}
      {tab === 'receivables' ? <ReceivablesPanel rows={receivables} /> : null}
      {tab === 'products' ? <ProductsPanel rows={products} /> : null}
      {tab === 'vat' ? <VatPanel vat={vat} /> : null}
    </section>
  )
}

function SalesPanel({ sales }: { sales: SalesReport }) {
  return (
    <div className="flex flex-col gap-4">
      <SummaryCards className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="CA facturé" value={formatCfa(sales.billed)} />
        <Kpi title="CA encaissé" value={formatCfa(sales.collected)} />
        <Kpi title="Factures" value={String(sales.invoiceCount)} hint={`${sales.estimationCount} devis`} />
        <Kpi
          title="Conversion"
          value={`${Math.round(sales.conversionRate * 100)} %`}
          hint={`Remises ${formatCfa(sales.discountTotal)}`}
        />
      </SummaryCards>
      <RevenueChart points={sales.history} caption="Évolution facturé vs encaissé" />
    </div>
  )
}

function ReceivablesPanel({ rows }: { rows: ReceivableRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] table-fixed text-left">
          <thead className="border-b border-subtle-border bg-powder/80">
            <tr>
              <th className="px-4 py-3 text-sm font-bold text-foreground-muted">Client</th>
              <th className="w-24 px-4 py-3 text-sm font-bold text-foreground-muted">Factures</th>
              <th className="w-36 px-4 py-3 text-sm font-bold text-foreground-muted">Reste</th>
              <th className="w-36 px-4 py-3 text-sm font-bold text-foreground-muted">Retard</th>
              <th className="w-36 px-4 py-3 text-sm font-bold text-foreground-muted">Échéance</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <Text variant="muted">Aucune créance ouverte.</Text>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.customerPublicId} className="border-b border-subtle-border last:border-0">
                  <td className="overflow-hidden px-4 py-3">
                    <Link href={`/dashboard/customers/${row.customerPublicId}`} className="font-bold text-primary hover:underline">
                      {row.customerName}
                    </Link>
                    <Caption className="block">
                      Facturé {formatCfa(row.billed)} · Encaissé {formatCfa(row.collected)}
                    </Caption>
                  </td>
                  <td className="px-4 py-3">{row.invoiceCount}</td>
                  <td className="px-4 py-3 font-bold">{formatCfa(row.remaining)}</td>
                  <td className="px-4 py-3 text-amber-700">{formatCfa(row.overdueAmount)}</td>
                  <td className="px-4 py-3">{row.oldestDueDate ? formatFrDate(row.oldestDueDate) : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function ProductsPanel({ rows }: { rows: ProductSaleRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] table-fixed text-left">
          <thead className="border-b border-subtle-border bg-powder/80">
            <tr>
              <th className="px-4 py-3 text-sm font-bold text-foreground-muted">Produit</th>
              <th className="w-28 px-4 py-3 text-sm font-bold text-foreground-muted">Qté</th>
              <th className="w-40 px-4 py-3 text-sm font-bold text-foreground-muted">CA HT</th>
              <th className="w-40 px-4 py-3 text-sm font-bold text-foreground-muted">CA TTC</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <Text variant="muted">Aucune vente sur la période.</Text>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.productId} className="border-b border-subtle-border last:border-0">
                  <td className="overflow-hidden px-4 py-3">
                    <Text weight="bold" className="truncate">{row.designation}</Text>
                    <Caption className="block">{row.code}</Caption>
                  </td>
                  <td className="px-4 py-3">{row.quantity}</td>
                  <td className="px-4 py-3">{formatCfa(row.revenueHt)}</td>
                  <td className="px-4 py-3 font-bold">{formatCfa(row.revenueTtc)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function VatPanel({ vat }: { vat: { rows: VatRow[]; ht: number; vat: number; ttc: number } }) {
  return (
    <div className="flex flex-col gap-4">
      <SummaryCards className="grid gap-4 sm:grid-cols-3">
        <Kpi title="Base HT" value={formatCfa(vat.ht)} />
        <Kpi title="TVA collectée" value={formatCfa(vat.vat)} />
        <Kpi title="TTC" value={formatCfa(vat.ttc)} />
      </SummaryCards>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] table-fixed text-left">
            <thead className="border-b border-subtle-border bg-powder/80">
              <tr>
                <th className="px-4 py-3 text-sm font-bold text-foreground-muted">Facture</th>
                <th className="px-4 py-3 text-sm font-bold text-foreground-muted">Client</th>
                <th className="w-32 px-4 py-3 text-sm font-bold text-foreground-muted">Date</th>
                <th className="w-32 px-4 py-3 text-sm font-bold text-foreground-muted">HT</th>
                <th className="w-32 px-4 py-3 text-sm font-bold text-foreground-muted">TVA</th>
                <th className="w-32 px-4 py-3 text-sm font-bold text-foreground-muted">TTC</th>
              </tr>
            </thead>
            <tbody>
              {vat.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <Text variant="muted">Aucune facture taxable sur la période.</Text>
                  </td>
                </tr>
              ) : (
                vat.rows.map((row) => (
                  <tr key={row.invoicePublicId} className="border-b border-subtle-border last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/invoices/${row.estimationPublicId}`} className="font-bold text-primary hover:underline">
                        {row.code}
                      </Link>
                    </td>
                    <td className="overflow-hidden px-4 py-3">
                      <span className="block truncate">{row.customerName}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatFrDate(row.date)}</td>
                    <td className="px-4 py-3">{formatCfa(row.ht)}</td>
                    <td className="px-4 py-3">{formatCfa(row.vat)}</td>
                    <td className="px-4 py-3 font-bold">{formatCfa(row.ttc)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Kpi({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <Caption className="font-bold tracking-wide uppercase">{title}</Caption>
      <Text weight="bold" className="mt-1 text-2xl">{value}</Text>
      {hint ? (
        <Caption className="mt-1 block">{hint}</Caption>
      ) : null}
    </Card>
  )
}
