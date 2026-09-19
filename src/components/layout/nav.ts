import type { UserRole } from '@prisma/client'
import { MANAGER_ROLES } from '@/lib/auth'

export type NavItem = {
  href: string
  label: string
  exact?: boolean
  roles?: UserRole[]
}

export const dashboardNav: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', exact: true },
  { href: '/dashboard/pos', label: 'Vente Comptoir' },
  { href: '/dashboard/products', label: 'Produits' },
  { href: '/dashboard/invoices', label: 'Devis & Factures' },
  { href: '/dashboard/payments', label: 'Règlements' },
  { href: '/dashboard/customers', label: 'Clients' },
  { href: '/dashboard/reports', label: 'Rapports', roles: MANAGER_ROLES },
  { href: '/dashboard/users', label: 'Utilisateurs', roles: MANAGER_ROLES },
  { href: '/dashboard/settings', label: 'Paramètres', roles: MANAGER_ROLES },
]

export function getSectionTitle(pathname: string) {
  const match = dashboardNav.find((item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
  )

  return match?.label ?? 'Dashboard'
}
