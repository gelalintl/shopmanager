'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useProductContext, type ProductSelectItem } from '@/context/product-context'
import { controlClass } from '@/components/ui/input'
import { formatCfa } from '@/lib/invoices'
import { cn } from '@/lib/cn'

export type Product = ProductSelectItem

type ProductComboboxProps = {
  value: string
  placeholder?: string
  onQueryChange: (query: string) => void
  onSelect: (product: Product) => void
}

function matchesQuery(product: Product, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return product.name.toLowerCase().includes(needle) || product.code.toLowerCase().includes(needle)
}

function optionLabel(product: Product) {
  if (product.type === 'PRESTATION') {
    return `[${product.code}] ${product.name} — ${formatCfa(product.unitPrice)} (Prestation)`
  }
  return `[${product.code}] ${product.name} — ${formatCfa(product.unitPrice)} (Stock disponible : ${product.stock})`
}

export function ProductCombobox({ value, placeholder, onQueryChange, onSelect }: ProductComboboxProps) {
  const { products, isLoading } = useProductContext()
  const listId = useId()
  const optionId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const results = useMemo(
    () => products.filter((product) => matchesQuery(product, value)).slice(0, 12),
    [products, value],
  )
  const activeIndex = results.length === 0 ? 0 : Math.min(highlight, results.length - 1)
  const activeOptionId = results[activeIndex] ? `${optionId}-${results[activeIndex].id}` : undefined

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!open) return
    const option = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    option?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  function closeMenu() {
    setOpen(false)
  }

  function selectProduct(product: Product) {
    onSelect(product)
    closeMenu()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setHighlight(0)
        return
      }
      setHighlight((index) => Math.min(index + 1, Math.max(results.length - 1, 0)))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      setHighlight((index) => Math.max(index - 1, 0))
      return
    }

    if (event.key === 'Home' && open) {
      event.preventDefault()
      setHighlight(0)
      return
    }

    if (event.key === 'End' && open && results.length > 0) {
      event.preventDefault()
      setHighlight(results.length - 1)
      return
    }

    if (event.key === 'Enter' && open) {
      const selected = results[activeIndex]
      if (!selected) return
      event.preventDefault()
      selectProduct(selected)
    }
  }

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? activeOptionId : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        className={controlClass}
        placeholder={isLoading ? 'Catalogue…' : placeholder ?? 'Rechercher un produit'}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onQueryChange(event.target.value)
          setHighlight(0)
          setOpen(true)
        }}
        onKeyDown={handleKeyDown}
      />
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-48 overflow-x-hidden overflow-y-auto rounded-md border border-subtle-border bg-white py-1 shadow-sm"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 font-sans text-sm text-foreground-muted">
              {isLoading ? 'Chargement du catalogue…' : 'Aucun produit correspondant'}
            </li>
          ) : (
            results.map((product, index) => {
              const active = index === activeIndex
              return (
                <li key={product.id} role="option" aria-selected={active} id={`${optionId}-${product.id}`}>
                  <button
                    type="button"
                    data-active={active ? 'true' : undefined}
                    className={cn(
                      'block w-full px-3 py-2 text-left font-sans text-sm transition-all duration-200',
                      active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-primary/10',
                    )}
                    onMouseEnter={() => setHighlight(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectProduct(product)}
                  >
                    {optionLabel(product)}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
}
