'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { BrandLogo } from '@/components/ui/logo'
import { cn } from '@/lib/cn'
import { dashboardNav } from '@/components/layout/nav'
import { roleAllowed } from '@/lib/auth'

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  )
}

function IconPos({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M8 8V6.5A2.5 2.5 0 0 1 10.5 4h3A2.5 2.5 0 0 1 16 6.5V8" />
      <path d="M8 13h2M12 13h2M16 13h.01M8 16h8" />
    </svg>
  )
}

function IconProducts({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2" />
    </svg>
  )
}

function IconInvoices({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5V3Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  )
}

function IconPayments({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  )
}

function IconCustomers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M16 19a4.2 4.2 0 0 1 4.5-4" />
    </svg>
  )
}

function IconReports({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15v-4M12 15V8M16 15v-7" />
    </svg>
  )
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="8" r="3" />
      <path d="M2.8 19a5.2 5.2 0 0 1 10.4 0" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M14.6 19a4.4 4.4 0 0 1 6.6-3.8" />
    </svg>
  )
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.6M17.5 16l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.6M17.5 8l1.6-1.6" />
    </svg>
  )
}

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

const icons: Record<string, (props: { className?: string }) => ReactNode> = {
  '/dashboard': IconDashboard,
  '/dashboard/pos': IconPos,
  '/dashboard/products': IconProducts,
  '/dashboard/invoices': IconInvoices,
  '/dashboard/payments': IconPayments,
  '/dashboard/reports': IconReports,
  '/dashboard/customers': IconCustomers,
  '/dashboard/users': IconUsers,
  '/dashboard/settings': IconSettings,
}

function isActivePath(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

const SIDEBAR_STORAGE_KEY = 'sidebar_collapsed'
const collapsedListeners = new Set<() => void>()

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

function subscribeCollapsed(onStoreChange: () => void) {
  collapsedListeners.add(onStoreChange)
  window.addEventListener('storage', onStoreChange)
  return () => {
    collapsedListeners.delete(onStoreChange)
    window.removeEventListener('storage', onStoreChange)
  }
}

function persistCollapsed(next: boolean) {
  window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
  collapsedListeners.forEach((listener) => listener())
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => true)
  const items = dashboardNav.filter((item) => !item.roles || roleAllowed(session?.user?.role, item.roles))

  return (
    <aside
      className={cn(
        'no-print sticky top-0 z-20 flex h-screen shrink-0 flex-col border-r border-subtle-border bg-white',
        'transition-all duration-200',
        collapsed ? 'w-[4.75rem]' : 'w-[17.5rem]',
      )}
    >
      <div
        className={cn(
          'flex border-b border-subtle-border',
          collapsed
            ? 'flex-col items-center gap-1 px-2 py-3'
            : 'h-16 flex-row items-center justify-between gap-2 px-4',
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => persistCollapsed(false)}
            title="Agrandir le menu"
            aria-label="Agrandir le menu"
            className="rounded-lg p-0.5 transition-all duration-200 hover:bg-primary/10"
          >
            <BrandLogo size="sm" showLabel={false} />
          </button>
        ) : (
          <BrandLogo size="sm" showLabel />
        )}
        <button
          type="button"
          onClick={() => persistCollapsed(!collapsed)}
          title={collapsed ? 'Agrandir le menu' : 'Réduire le menu'}
          aria-label={collapsed ? 'Agrandir le menu' : 'Réduire le menu'}
          aria-expanded={!collapsed}
          className="rounded-md p-1.5 text-foreground-muted transition-all duration-200 hover:bg-primary/10 hover:text-primary"
        >
          {collapsed ? (
            <IconChevronRight className="h-5 w-5" />
          ) : (
            <IconChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Navigation principale">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const Icon = icons[item.href]
            const active = isActivePath(pathname, item.href, item.exact)

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-bold',
                    'transition-all duration-200',
                    collapsed ? 'justify-center px-0' : 'px-3',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-primary/10 hover:text-primary',
                  )}
                >
                  {active ? (
                    <span className="absolute top-1.5 bottom-1.5 left-0 w-1 rounded-r bg-primary" />
                  ) : null}
                  {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
                  {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
