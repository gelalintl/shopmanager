'use client'

import { InputField } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import type { CustomerTypeFilter } from '@/lib/customers'

const typeFilters: { id: CustomerTypeFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'COMPANY', label: 'Entreprises' },
  { id: 'INDIVIDUAL', label: 'Particuliers' },
]

type CustomerFiltersProps = {
  query: string
  onQueryChange: (value: string) => void
  type: CustomerTypeFilter
  onTypeChange: (value: CustomerTypeFilter) => void
}

export function CustomerFilters({
  query,
  onQueryChange,
  type,
  onTypeChange,
}: CustomerFiltersProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="w-full max-w-md">
        <InputField
          id="customer-search"
          name="q"
          label="Recherche"
          placeholder="Nom, NIF, téléphone ou email"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par type">
        {typeFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => onTypeChange(filter.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-bold transition-all duration-200',
              type === filter.id
                ? 'border-primary bg-primary text-white'
                : 'border-subtle-border bg-white text-foreground hover:border-primary hover:text-primary',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  )
}
