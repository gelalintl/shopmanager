export type NavItem = {
  href: string
  label: string
  exact?: boolean
}

export const dashboardNav: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', exact: true },
  { href: '/dashboard/products', label: 'Produits' },
  { href: '/dashboard/invoices', label: 'Devis & Factures' },
  { href: '/dashboard/payments', label: 'Règlements' },
  { href: '/dashboard/reports', label: 'Rapports' },
  { href: '/dashboard/customers', label: 'Clients' },
  { href: '/dashboard/settings', label: 'Paramètres' },
]

export function getSectionTitle(pathname: string) {
  const match = dashboardNav.find((item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
  )

  return match?.label ?? 'Dashboard'
}
