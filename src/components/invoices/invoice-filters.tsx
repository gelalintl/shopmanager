'use client'

import type { ChangeEvent, ReactNode } from 'react'
import { IconSearch } from '@/components/ui/icons'

const labelClass = 'block text-xs font-medium text-slate-600 mb-1'
const fieldClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

export type InvoiceFilterValues = {
  startDate: string
  endDate: string
  customerId: string
  searchQuery: string
}

type InvoiceFiltersProps = {
  startDate: string
  endDate: string
  customerId: string
  searchQuery: string
  customers: Array<{ publicId: string; name: string }>
  onChange: (next: InvoiceFilterValues) => void
}

export function InvoiceFilters({
  startDate,
  endDate,
  customerId,
  searchQuery,
  customers,
  onChange,
}: InvoiceFiltersProps) {
  return (
    <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <FilterField id="startDate" label="Du">
        <input
          id="startDate"
          name="startDate"
          type="date"
          value={startDate}
          className={fieldClass}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange({ startDate: event.target.value, endDate, customerId, searchQuery })
          }
        />
      </FilterField>
      <FilterField id="endDate" label="Au">
        <input
          id="endDate"
          name="endDate"
          type="date"
          value={endDate}
          className={fieldClass}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange({ startDate, endDate: event.target.value, customerId, searchQuery })
          }
        />
      </FilterField>
      <FilterField id="customerId" label="Client">
        <select
          id="customerId"
          name="customerId"
          className={fieldClass}
          value={customerId}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onChange({ startDate, endDate, customerId: event.target.value, searchQuery })
          }
        >
          <option value="">Tous les clients</option>
          {customers.map((customer) => (
            <option key={customer.publicId} value={customer.publicId}>
              {customer.name}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField id="searchQuery" label="Recherche">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="searchQuery"
            name="searchQuery"
            type="search"
            value={searchQuery}
            placeholder="DEV-… / FAC-…"
            className={`${fieldClass} pl-9`}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({ startDate, endDate, customerId, searchQuery: event.target.value })
            }
          />
        </div>
      </FilterField>
    </div>
  )
}

function FilterField({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  )
}
