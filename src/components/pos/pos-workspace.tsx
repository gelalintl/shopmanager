'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { controlClass } from '@/components/ui/input'
import { IconPrinter, IconSearch, IconTrash, IconUndo } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { computeTotals, formatCfa } from '@/lib/invoices'
import { getStockStatus } from '@/lib/products'
import { PAYMENT_METHODS, paymentMethodLabels, type PaymentMethod } from '@/lib/payments'
import { useProductContext } from '@/context/product-context'
import {
  getPosBootstrap,
  processDirectSale,
  searchPosProducts,
  createCreditNote,
} from '@/app/dashboard/pos/actions'
import { type CartItem, type PosProduct, type PosSaleSuccess, WALK_IN_CUSTOMER_NAME } from '@/app/dashboard/pos/types'
import type { CatalogCustomer } from '@/lib/invoices'
import { CreditNoteModal } from '@/components/invoices/credit-note-modal'
import { toast } from 'sonner'

function matchesQuery(product: PosProduct, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return false
  return (
    product.code.toLowerCase() === needle ||
    product.code.toLowerCase().includes(needle) ||
    product.designation.toLowerCase().includes(needle)
  )
}

function stockTone(quantity: number) {
  const status = getStockStatus(quantity, 0)
  if (status === 'out') return 'text-danger'
  if (quantity <= 3) return 'text-amber-600'
  return 'text-emerald-700'
}

export function PosWorkspace() {
  const { refreshProducts } = useProductContext()
  const searchRef = useRef<HTMLInputElement>(null)
  const [walkIn, setWalkIn] = useState<CatalogCustomer | null>(null)
  const [customers, setCustomers] = useState<CatalogCustomer[]>([])
  const [catalog, setCatalog] = useState<PosProduct[]>([])
  const [frequent, setFrequent] = useState<PosProduct[]>([])
  const [customerId, setCustomerId] = useState('')
  const [query, setQuery] = useState('')
  const [remoteSuggestions, setRemoteSuggestions] = useState<PosProduct[]>([])
  const [highlight, setHighlight] = useState(0)
  const [cart, setCart] = useState<CartItem[]>([])
  const [hasTva, setHasTva] = useState(true)
  const [discountRate, setDiscountRate] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [tendered, setTendered] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<PosSaleSuccess | null>(null)
  const [creditOpen, setCreditOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const data = await getPosBootstrap()
      if (cancelled) return
      setWalkIn(data.walkIn)
      setCustomers(data.customers)
      setCatalog(data.products)
      setFrequent(data.frequent)
      if (data.walkIn) setCustomerId(data.walkIn.publicId)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const needle = query.trim()
  const localSuggestions = useMemo(
    () => (needle ? catalog.filter((product) => matchesQuery(product, needle)).slice(0, 12) : []),
    [catalog, needle],
  )
  const suggestions = needle
    ? remoteSuggestions.length > 0
      ? remoteSuggestions
      : localSuggestions
    : []
  const suggestOpen = suggestions.length > 0

  useEffect(() => {
    if (!needle) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void searchPosProducts(needle).then((rows) => {
        if (!cancelled) setRemoteSuggestions(rows)
      })
    }, 160)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [needle])

  const stockByProduct = useMemo(() => {
    const map = new Map(catalog.map((product) => [product.id, product.stock]))
    return map
  }, [catalog])

  const totals = useMemo(
    () =>
      computeTotals(
        cart.map((line) => ({
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          discountRate: 0,
        })),
        hasTva,
        discountRate,
      ),
    [cart, hasTva, discountRate],
  )

  const typedTendered = Math.round(Number(tendered.replace(/\s/g, '')) || 0)
  const received = paymentMethod === 'CASH' ? typedTendered : Math.max(typedTendered, totals.ttc)
  const change = received - totals.ttc
  const canCheckout = cart.length > 0 && received >= totals.ttc && totals.ttc > 0 && !loading

  function remainingStock(productId: number, ignoreCart = false) {
    const base = stockByProduct.get(productId) ?? 0
    if (ignoreCart) return base
    const inCart = cart.find((line) => line.productId === productId)?.quantity ?? 0
    return base - inCart
  }

  function addProduct(product: PosProduct, quantity = 1) {
    const available = remainingStock(product.id)
    if (available < quantity) {
      toast.error(
        product.stock <= 0
          ? `${product.designation} est en rupture.`
          : `Stock insuffisant pour ${product.designation} (reste ${Math.max(available, 0)}).`,
      )
      return
    }

    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id)
      if (existing) {
        return current.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + quantity, stock: product.stock } : line,
        )
      }
      return [
        ...current,
        {
          productId: product.id,
          publicId: product.publicId,
          code: product.code,
          designation: product.designation,
          unitPrice: product.unitPrice,
          quantity,
          stock: product.stock,
        },
      ]
    })
    setQuery('')
    setRemoteSuggestions([])
    searchRef.current?.focus()
  }

  function setQuantity(productId: number, quantity: number) {
    const line = cart.find((item) => item.productId === productId)
    if (!line) return
    const max = stockByProduct.get(productId) ?? line.stock
    const next = Math.min(Math.max(Math.floor(quantity), 0), max)
    if (next <= 0) {
      setCart((current) => current.filter((item) => item.productId !== productId))
      return
    }
    setCart((current) => current.map((item) => (item.productId === productId ? { ...item, quantity: next } : item)))
  }

  function resetSale() {
    setCart([])
    setDiscountRate(0)
    setHasTva(true)
    setPaymentMethod('CASH')
    setTendered('')
    setSuccess(null)
    if (walkIn) setCustomerId(walkIn.publicId)
    searchRef.current?.focus()
  }

  async function checkout() {
    if (!canCheckout) return
    setLoading(true)
    const result = await processDirectSale({
      customerPublicId: customerId || walkIn?.publicId,
      lines: cart.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      hasTva,
      globalDiscountRate: discountRate,
      paymentMethod,
      amountTendered: received,
    })
    setLoading(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Vente de ${formatCfa(result.totalTtc)} validée`)
    setSuccess({
      publicId: result.publicId,
      code: result.code,
      totalTtc: result.totalTtc,
      change: result.change,
      amountTendered: result.amountTendered,
    })
    await refreshProducts()
    const data = await getPosBootstrap()
    setCatalog(data.products)
    setFrequent(data.frequent)
    setWalkIn(data.walkIn)
    setCustomers(data.customers)
  }

  const exact = suggestions.find((product) => product.code.toLowerCase() === query.trim().toLowerCase())

  return (
    <div className="-mx-4 -my-6 grid min-h-[calc(100vh-4rem)] gap-4 p-4 sm:-mx-6 sm:p-6 xl:grid-cols-[minmax(0,1.15fr)_24rem]">
      <section className="flex min-w-0 flex-col gap-4">
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="pos-search" className="mb-1 block text-sm font-bold">
                Recherche produit
              </label>
              <div className="relative">
                <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-foreground-muted" />
                <input
                  ref={searchRef}
                  id="pos-search"
                  value={query}
                  autoComplete="off"
                  placeholder="Code, référence, nom…"
                  className={cn(controlClass, 'pl-10')}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setRemoteSuggestions([])
                    setHighlight(0)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setQuery('')
                      setRemoteSuggestions([])
                      return
                    }
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      setHighlight((index) => Math.min(index + 1, Math.max(suggestions.length - 1, 0)))
                      return
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      setHighlight((index) => Math.max(index - 1, 0))
                      return
                    }
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      const chosen = exact ?? suggestions[highlight]
                      if (chosen) addProduct(chosen)
                    }
                  }}
                />
              </div>
              {suggestOpen && suggestions.length > 0 ? (
                <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-subtle-border bg-white shadow-lg">
                  {suggestions.map((product, index) => (
                    <li key={product.publicId}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm',
                          index === highlight ? 'bg-soft-cobalt' : 'hover:bg-powder',
                        )}
                        onMouseEnter={() => setHighlight(index)}
                        onClick={() => addProduct(product)}
                      >
                        <span>
                          <span className="font-bold text-cobalt">{product.code}</span>
                          <span className="ml-2">{product.designation}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-bold">{formatCfa(product.unitPrice)}</span>
                          <span className={cn('text-xs', stockTone(product.stock))}>Stock {product.stock}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="sm:w-64">
              <label htmlFor="pos-customer" className="mb-1 block text-sm font-bold">
                Client
              </label>
              <select
                id="pos-customer"
                className={controlClass}
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                {walkIn ? (
                  <option value={walkIn.publicId}>{walkIn.name || WALK_IN_CUSTOMER_NAME}</option>
                ) : (
                  <option value="">{WALK_IN_CUSTOMER_NAME}</option>
                )}
                {customers
                  .filter((customer) => customer.publicId !== walkIn?.publicId)
                  .map((customer) => (
                    <option key={customer.publicId} value={customer.publicId}>
                      {customer.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </Card>

        <div>
          <Heading as="h2" size="md">
            Produits fréquents
          </Heading>
          <Caption className="mt-0.5 block">Stock disponible en temps réel</Caption>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {frequent.length === 0 ? (
            <Card className="p-6 text-sm text-foreground-muted sm:col-span-2 xl:col-span-3">
              Aucun produit fréquent pour le moment. Utilisez la recherche pour ajouter un article.
            </Card>
          ) : null}
          {frequent.map((product) => {
            const left = remainingStock(product.id)
            return (
              <button
                key={product.publicId}
                type="button"
                disabled={left <= 0}
                onClick={() => addProduct(product)}
                className={cn(
                  'rounded-2xl border border-subtle-border bg-white p-4 text-left shadow-sm transition-all duration-200',
                  'hover:border-cobalt hover:bg-soft-cobalt/60',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <Text size="sm" className="font-bold text-cobalt">
                  {product.code}
                </Text>
                <Text weight="bold" className="mt-1 line-clamp-2">
                  {product.designation}
                </Text>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <span className="text-lg font-bold">{formatCfa(product.unitPrice)}</span>
                  <span className={cn('text-xs font-bold', stockTone(left))}>Stock {left}</span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <aside className="flex flex-col">
        <Card className="flex h-full flex-col p-4">
          <Heading as="h2" size="md">
            Panier & caisse
          </Heading>

          <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
            {cart.length === 0 ? (
              <li className="rounded-xl bg-powder px-3 py-8 text-center text-sm text-foreground-muted">
                Scannez ou ajoutez un article.
              </li>
            ) : (
              cart.map((line) => (
                <li key={line.productId} className="rounded-xl border border-subtle-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Text size="sm" className="font-bold">
                        {line.designation}
                      </Text>
                      <Caption>
                        {line.code} · {formatCfa(line.unitPrice)}
                      </Caption>
                    </div>
                    <button
                      type="button"
                      className="rounded-md p-1 text-foreground-muted hover:bg-red-50 hover:text-danger"
                      aria-label={`Retirer ${line.designation}`}
                      onClick={() => setCart((current) => current.filter((item) => item.productId !== line.productId))}
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setQuantity(line.productId, line.quantity - 1)}>
                        −
                      </Button>
                      <input
                        aria-label={`Quantité ${line.designation}`}
                        className="h-9 w-14 rounded-md border border-subtle-border text-center font-bold"
                        value={line.quantity}
                        onChange={(event) => setQuantity(line.productId, Number(event.target.value))}
                      />
                      <Button size="sm" variant="secondary" onClick={() => setQuantity(line.productId, line.quantity + 1)}>
                        +
                      </Button>
                    </div>
                    <Text weight="bold">{formatCfa(line.unitPrice * line.quantity)}</Text>
                  </div>
                </li>
              ))
            )}
          </ul>

          <div className="mt-4 space-y-2 border-t border-subtle-border pt-3 text-sm">
            <label className="flex items-center justify-between gap-3 font-bold">
              <span>TVA 19 %</span>
              <input type="checkbox" checked={hasTva} onChange={(event) => setHasTva(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="font-bold">Remise %</span>
              <input
                type="number"
                min={0}
                max={100}
                className="h-9 w-20 rounded-md border border-subtle-border px-2 text-right"
                value={discountRate}
                onChange={(event) => setDiscountRate(Math.min(Math.max(Number(event.target.value) || 0, 0), 100))}
              />
            </label>
            <div className="flex justify-between text-foreground-muted">
              <span>Sous-total HT</span>
              <span>{formatCfa(totals.ht)}</span>
            </div>
            {totals.globalDiscount > 0 ? (
              <div className="flex justify-between text-foreground-muted">
                <span>Remise</span>
                <span>- {formatCfa(totals.globalDiscount)}</span>
              </div>
            ) : null}
            {hasTva ? (
              <div className="flex justify-between text-foreground-muted">
                <span>TVA</span>
                <span>{formatCfa(totals.vat)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-lg font-bold text-cobalt">
              <span>Net à payer</span>
              <span>{formatCfa(totals.ttc)}</span>
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-2 text-sm font-bold">Mode de règlement</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(method)
                    if (method !== 'CASH' && totals.ttc > 0) setTendered(String(totals.ttc))
                  }}
                  className={cn(
                    'rounded-full border px-3 py-2 text-sm font-bold transition-all duration-200',
                    paymentMethod === method
                      ? 'border-cobalt bg-soft-cobalt text-cobalt'
                      : 'border-subtle-border bg-white text-foreground hover:bg-powder',
                  )}
                >
                  {paymentMethodLabels[method]}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-3 block text-sm font-bold" htmlFor="pos-tendered">
            Montant encaissé
          </label>
          <input
            id="pos-tendered"
            inputMode="numeric"
            className={controlClass}
            placeholder={formatCfa(totals.ttc)}
            value={tendered}
            onChange={(event) => setTendered(event.target.value)}
          />
          <div
            className={cn(
              'mt-2 rounded-xl px-3 py-2 text-sm font-bold',
              change >= 0 && received > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-powder text-foreground-muted',
            )}
          >
            Monnaie à rendre : {received > 0 ? formatCfa(Math.max(change, 0)) : formatCfa(0)}
          </div>

          <Button className="mt-4 w-full" size="lg" disabled={!canCheckout} isLoading={loading} onClick={() => void checkout()}>
            Encaisser {totals.ttc > 0 ? formatCfa(totals.ttc) : ''}
          </Button>
        </Card>
      </aside>

      {success ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Fermer" onClick={resetSale} />
          <Card className="relative w-full max-w-md p-6">
            <Heading as="h2" size="md">
              Vente soldée
            </Heading>
            <Text className="mt-2">
              Facture <span className="font-bold">{success.code}</span> · {formatCfa(success.totalTtc)}
            </Text>
            <Text size="sm" className="mt-1 text-emerald-700">
              Rendu : {formatCfa(success.change)}
            </Text>
            <div className="mt-5 flex flex-col gap-2">
              <Link href={`/dashboard/pos/${success.publicId}/print?format=ticket`} className="w-full">
                <Button className="w-full">
                  <IconPrinter className="h-4 w-4" />
                  Imprimer le reçu / Ticket
                </Button>
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/dashboard/pos/${success.publicId}/print?format=a5`}>
                  <Button variant="outline" className="w-full">
                    A5
                  </Button>
                </Link>
                <Link href={`/dashboard/pos/${success.publicId}/print?format=a4`}>
                  <Button variant="outline" className="w-full">
                    A4
                  </Button>
                </Link>
              </div>
              <Button variant="outline" onClick={() => setCreditOpen(true)}>
                <IconUndo className="h-4 w-4" />
                Créer un Avoir / Remboursement
              </Button>
              <Button variant="secondary" onClick={resetSale}>
                Nouvelle vente
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {success && creditOpen ? (
        <CreditNoteModal
          open
          invoicePublicId={success.publicId}
          invoiceCode={success.code}
          maxAmount={success.totalTtc}
          createAction={createCreditNote}
          onClose={() => setCreditOpen(false)}
          onDone={(publicId) => {
            setCreditOpen(false)
            window.open(`/dashboard/invoices/credit-notes/${publicId}/print?format=ticket`, '_blank')
          }}
        />
      ) : null}
    </div>
  )
}
