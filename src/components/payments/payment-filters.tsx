'use client'

import type { ChangeEvent, ReactNode } from 'react'
import { PAYMENT_METHODS, paymentMethodLabels, type PaymentMethodFilter } from '@/lib/payments'

const labelClass = 'block text-xs font-medium text-slate-600 mb-1'
const fieldClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

type PaymentFiltersProps = {
  from: string
  to: string
  customerPublicId: string
  paymentMethod: PaymentMethodFilter
  customers: Array<{ publicId: string; name: string }>
  onChange: (next: {
    from: string
    to: string
    customerPublicId: string
    paymentMethod: PaymentMethodFilter
  }) => void
}

export function PaymentFilters({
  from,
  to,
  customerPublicId,
  paymentMethod,
  customers,
  onChange,
}: PaymentFiltersProps) {
  return (
    <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <FilterField id="from" label="Du">
        <input
          id="from"
          name="from"
          type="date"
          value={from}
          className={fieldClass}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange({ from: event.target.value, to, customerPublicId, paymentMethod })
          }
        />
      </FilterField>
      <FilterField id="to" label="Au">
        <input
          id="to"
          name="to"
          type="date"
          value={to}
          className={fieldClass}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange({ from, to: event.target.value, customerPublicId, paymentMethod })
          }
        />
      </FilterField>
      <FilterField id="customer" label="Client">
        <select
          id="customer"
          className={fieldClass}
          value={customerPublicId}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onChange({ from, to, customerPublicId: event.target.value, paymentMethod })
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
      <FilterField id="paymentMethod" label="Mode de paiement">
        <select
          id="paymentMethod"
          className={fieldClass}
          value={paymentMethod}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onChange({
              from,
              to,
              customerPublicId,
              paymentMethod: event.target.value as PaymentMethodFilter,
            })
          }
        >
          <option value="all">Tous</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {paymentMethodLabels[method]}
            </option>
          ))}
        </select>
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
