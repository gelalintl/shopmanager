'use client'

import { InputField } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import type { StockFilter } from '@/lib/products'

const statusFilters: { id: StockFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'ok', label: 'Stock normal' },
  { id: 'low', label: 'Stock faible / Alerte' },
  { id: 'out', label: 'Rupture' },
]

type ProductFiltersProps = {
  query: string
  onQueryChange: (value: string) => void
  status: StockFilter
  onStatusChange: (value: StockFilter) => void
}

export function ProductFilters({
  query,
  onQueryChange,
  status,
  onStatusChange,
}: ProductFiltersProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="w-full max-w-md">
        <InputField
          id="product-search"
          name="q"
          label="Recherche"
          placeholder="Code ou Désignation"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par stock">
        {statusFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => onStatusChange(filter.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-bold transition-all duration-200',
              status === filter.id
                ? 'border-cobalt bg-cobalt text-white'
                : 'border-subtle-border bg-white text-foreground hover:border-cobalt hover:text-cobalt',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  )
}
