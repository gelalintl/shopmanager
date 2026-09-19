'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { InputField, controlClass, quietControlClass } from '@/components/ui/input'
import { Caption, Heading } from '@/components/ui/typography'
import { CustomerModal } from '@/components/customers/customer-modal'
import { InvoiceLineRow } from '@/components/invoices/invoice-line-row'
import { InvoicePrintTemplate } from '@/components/invoices/invoice-print-template'
import { createDocument } from '@/app/dashboard/invoices/actions'
import { toastResult } from '@/lib/notify'
import { useProductContext } from '@/context/product-context'
import type { Product } from '@/components/invoices/product-combobox'
import {
  addDays,
  computeTotals,
  formatFrDate,
  lineHt,
  parseLocalDate,
  toInputDate,
  type CatalogCustomer,
  type DocumentKind,
  type InvoiceItem,
  type PrintCompany,
  type PrintSettings,
} from '@/lib/invoices'
import { cn } from '@/lib/cn'

type InvoiceBuilderProps = {
  kind: DocumentKind
  customers: CatalogCustomer[]
  company: PrintCompany
  settings: PrintSettings
  initialCustomerId?: string
}

function emptyLine(): InvoiceItem {
  return {
    key: `line-${Math.random().toString(36).slice(2, 9)}`,
    productId: null,
    designation: '',
    unitPrice: 0,
    quantity: 1,
    discountRate: 0,
    query: '',
  }
}

export function InvoiceBuilder({
  kind,
  customers,
  company,
  settings,
  initialCustomerId = '',
}: InvoiceBuilderProps) {
  const router = useRouter()
  const { refreshProducts } = useProductContext()
  const [customerId, setCustomerId] = useState(initialCustomerId)
  const [hasTva, setHasTva] = useState(true)
  const [warranty, setWarranty] = useState(settings.defaultWarrantyMonths)
  const [globalDiscountRate, setGlobalDiscountRate] = useState(0)
  const [notes, setNotes] = useState('')
  const [issueDate, setIssueDate] = useState(() => toInputDate(new Date()))
  const [validityDays, setValidityDays] = useState(30)
  const [dueDate, setDueDate] = useState('')
  const [lines, setLines] = useState<InvoiceItem[]>([emptyLine()])
  const [customerOpen, setCustomerOpen] = useState(false)
  const [extraCustomers, setExtraCustomers] = useState<CatalogCustomer[]>([])
  const [loading, setLoading] = useState<'draft' | 'official' | null>(null)

  const allCustomers = useMemo(() => {
    const extras = extraCustomers
    return [...extras, ...customers.filter((item) => !extras.some((extra) => extra.publicId === item.publicId))]
  }, [customers, extraCustomers])

  const customer = useMemo(
    () => allCustomers.find((item) => item.publicId === customerId) ?? null,
    [allCustomers, customerId],
  )

  const totals = useMemo(
    () => computeTotals(lines, hasTva, globalDiscountRate),
    [lines, hasTva, globalDiscountRate],
  )

  const validUntil = useMemo(
    () => addDays(parseLocalDate(issueDate), validityDays),
    [issueDate, validityDays],
  )

  const previewLines = useMemo(
    () =>
      lines.map((line) => ({
        designation: line.designation || '—',
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountRate: line.discountRate,
        ht: lineHt(line.unitPrice, line.quantity, line.discountRate),
      })),
    [lines],
  )

  const previewCode = kind === 'INVOICE' ? 'FAC-APERÇU' : 'DEV-APERÇU'

  const updateLine = useCallback((key: string, patch: Partial<InvoiceItem>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }, [])

  const selectProduct = useCallback((key: string, product: Product) => {
    setLines((current) =>
      current.map((line) =>
        line.key === key
          ? {
              ...line,
              productId: product.id,
              designation: product.name,
              unitPrice: product.unitPrice,
              query: product.name,
            }
          : line,
      ),
    )
  }, [])

  const removeLine = useCallback((key: string) => {
    setLines((current) => current.filter((line) => line.key !== key))
  }, [])

  async function save(official: boolean) {
    setLoading(official ? 'official' : 'draft')
    const result = await createDocument({
      kind,
      official,
      customerPublicId: customerId,
      hasTva,
      warranty,
      globalDiscountRate,
      notes,
      issueDate,
      validityDays,
      dueDate: dueDate || null,
      lines: lines.map((line) => ({
        productId: line.productId ?? undefined,
        designation: line.designation,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        discountRate: line.discountRate,
      })),
    })
    setLoading(null)
    const success =
      kind === 'INVOICE'
        ? official
          ? 'Facture créée'
          : 'Brouillon enregistré.'
        : official
          ? 'Devis créé.'
          : 'Brouillon enregistré.'
    if (!toastResult(result, success)) return
    router.push(result.publicId ? `/dashboard/invoices/${result.publicId}` : '/dashboard/invoices')
    router.refresh()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_210mm]">
      <section className="rounded-2xl border border-subtle-border bg-white p-5 shadow-sm">
        <Heading as="h2" size="lg">
          {kind === 'INVOICE' ? 'Nouvelle facture' : 'Nouveau devis'}
        </Heading>

        <div className="mt-4 rounded-xl border border-subtle-border/80 bg-powder/50 p-4">
          <Caption className="uppercase tracking-wide">Informations générales</Caption>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="font-sans text-xs font-normal text-foreground-muted">N° document</p>
              <p className="mt-1 font-bold text-cobalt">{previewCode}</p>
            </div>
            <label className="font-sans text-xs font-normal text-foreground-muted">
              Date d’émission
              <input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
                className={cn(quietControlClass, 'mt-1')}
              />
            </label>
            {kind === 'ESTIMATION' ? (
              <label className="font-sans text-xs font-normal text-foreground-muted">
                Validité (jours)
                <input
                  id="validityDays"
                  type="number"
                  min={1}
                  max={3650}
                  value={validityDays}
                  onChange={(event) => setValidityDays(Math.max(1, Number(event.target.value) || 30))}
                  className={cn(quietControlClass, 'mt-1 text-foreground')}
                />
                <span className="mt-1 block text-[11px] font-normal text-foreground-muted">
                  Jusqu’au {formatFrDate(validUntil)}
                </span>
              </label>
            ) : (
              <InputField
                id="dueDate"
                label="Échéance de paiement"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 font-sans text-sm font-bold">
            Client
            <select
              className={cn(controlClass, 'mt-1')}
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              <option value="">Sélectionner un client</option>
              {allCustomers.map((item) => (
                <option key={item.publicId} value={item.publicId}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="outline" onClick={() => setCustomerOpen(true)}>
            Nouveau client
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 font-sans text-sm font-bold">
            <input type="checkbox" checked={hasTva} onChange={(event) => setHasTva(event.target.checked)} />
            TVA 19 %
          </label>
          <InputField
            id="warranty"
            label="Garantie (mois)"
            type="number"
            min={0}
            max={12}
            value={warranty}
            onChange={(event) => setWarranty(Number(event.target.value) || 0)}
          />
          <InputField
            id="globalDiscount"
            label="Remise globale (%)"
            type="number"
            min={0}
            max={100}
            value={globalDiscountRate}
            onChange={(event) => setGlobalDiscountRate(Number(event.target.value) || 0)}
          />
        </div>

        <div className="mt-6">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-subtle-border text-left text-foreground-muted">
                <th className="min-w-0 py-2">
                  <span className="flex items-center gap-2 font-sans">
                    Article
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => void refreshProducts()}
                    >
                      Rafraîchir le catalogue
                    </Button>
                  </span>
                </th>
                <th className="w-16 py-2 font-sans">Qté</th>
                <th className="w-24 py-2 font-sans">P.U.</th>
                <th className="w-16 py-2 font-sans">Remise %</th>
                <th className="w-10 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <InvoiceLineRow
                  key={line.key}
                  line={line}
                  onChange={updateLine}
                  onSelectProduct={selectProduct}
                  onRemove={removeLine}
                />
              ))}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="secondary" className="mt-3" onClick={() => setLines((current) => [...current, emptyLine()])}>
          Ajouter une ligne
        </Button>

        <label className="mt-4 block font-sans text-sm font-bold">
          Notes
          <textarea
            className={cn(controlClass, 'mt-1 min-h-20')}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" variant="outline" isLoading={loading === 'draft'} onClick={() => save(false)}>
            Enregistrer brouillon
          </Button>
          <Button type="button" isLoading={loading === 'official'} onClick={() => save(true)}>
            Émettre {kind === 'INVOICE' ? 'la facture' : 'le devis'}
          </Button>
        </div>
      </section>

      <aside className="hidden justify-center overflow-auto rounded-2xl bg-powder p-4 xl:flex">
        <div className="origin-top scale-[0.82]">
          <InvoicePrintTemplate
            kind={kind}
            code={previewCode}
            dateLabel={`Niamey, le ${formatFrDate(issueDate)}`}
            company={company}
            customer={customer}
            lines={previewLines}
            totals={totals}
            warranty={warranty}
            settings={settings}
            notes={notes}
            validityDays={kind === 'ESTIMATION' ? validityDays : undefined}
            validUntil={kind === 'ESTIMATION' ? validUntil.toISOString() : null}
          />
        </div>
      </aside>

      <CustomerModal
        open={customerOpen}
        onClose={() => setCustomerOpen(false)}
        onCreated={(snapshot) => {
          setExtraCustomers((current) => [
            snapshot,
            ...current.filter((item) => item.publicId !== snapshot.publicId),
          ])
          setCustomerId(snapshot.publicId)
        }}
      />
    </div>
  )
}
