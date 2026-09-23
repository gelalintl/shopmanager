'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { parseSortDir, type SortDir } from '@/lib/table-sort'
import { cn } from '@/lib/cn'

type SortableHeaderProps = {
  sortKey: string
  label: string
  className?: string
  fallbackKey: string
  fallbackDir?: SortDir
  initialDir?: SortDir
}

export function SortableHeader({
  sortKey,
  label,
  className,
  fallbackKey,
  fallbackDir = 'asc',
  initialDir = 'asc',
}: SortableHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentKey = searchParams.get('sort') || fallbackKey
  const currentDir = parseSortDir(searchParams.get('dir'), fallbackDir)
  const active = currentKey === sortKey

  function toggle() {
    const nextDir = active ? (currentDir === 'asc' ? 'desc' : 'asc') : initialDir
    const params = new URLSearchParams(searchParams.toString())
    const isFallback = sortKey === fallbackKey && nextDir === fallbackDir
    if (isFallback) {
      params.delete('sort')
      params.delete('dir')
    } else {
      params.set('sort', sortKey)
      params.set('dir', nextDir)
    }
    params.delete('page')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <th className={cn('px-4 py-3 text-sm font-bold text-foreground-muted', className)} aria-sort={active ? (currentDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={toggle}
        className="inline-flex max-w-full items-center gap-1.5 rounded-md text-left transition-all duration-200 hover:text-cobalt focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
      >
        <span className="truncate">{label}</span>
        <span className="inline-flex shrink-0 flex-col leading-none" aria-hidden="true">
          <svg viewBox="0 0 12 8" className={cn('h-2 w-2.5', active && currentDir === 'asc' ? 'text-cobalt' : 'text-foreground-muted/35')} fill="currentColor">
            <path d="M6 1.2 10.5 6.5H1.5Z" />
          </svg>
          <svg viewBox="0 0 12 8" className={cn('-mt-0.5 h-2 w-2.5', active && currentDir === 'desc' ? 'text-cobalt' : 'text-foreground-muted/35')} fill="currentColor">
            <path d="M6 6.8 1.5 1.5h9Z" />
          </svg>
        </span>
      </button>
    </th>
  )
}
