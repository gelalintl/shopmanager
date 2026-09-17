'use client'

import type { ChangeEvent } from 'react'
import { filterFieldClass, filterLabelClass, type ReportPreset } from '@/lib/analytics'

const presets: { id: ReportPreset; label: string }[] = [
  { id: 'month', label: 'Mois' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Année' },
  { id: 'custom', label: 'Personnalisé' },
]

type ReportsFiltersProps = {
  preset: ReportPreset
  startDate: string
  endDate: string
  onChange: (next: { preset: ReportPreset; startDate: string; endDate: string }) => void
}

export function ReportsFilters({ preset, startDate, endDate, onChange }: ReportsFiltersProps) {
  return (
    <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="min-w-0">
        <span className={filterLabelClass}>Période</span>
        <select
          id="preset"
          className={filterFieldClass}
          value={preset}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onChange({ preset: event.target.value as ReportPreset, startDate, endDate })
          }
        >
          {presets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0">
        <label htmlFor="startDate" className={filterLabelClass}>
          Du
        </label>
        <input
          id="startDate"
          type="date"
          className={filterFieldClass}
          value={startDate}
          disabled={preset !== 'custom'}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange({ preset: 'custom', startDate: event.target.value, endDate })
          }
        />
      </div>
      <div className="min-w-0">
        <label htmlFor="endDate" className={filterLabelClass}>
          Au
        </label>
        <input
          id="endDate"
          type="date"
          className={filterFieldClass}
          value={endDate}
          disabled={preset !== 'custom'}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange({ preset: 'custom', startDate, endDate: event.target.value })
          }
        />
      </div>
    </div>
  )
}
