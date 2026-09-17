'use client'

import { usePathname } from 'next/navigation'
import { Caption, Heading } from '@/components/ui/typography'
import { UserMenu } from '@/components/layout/user-menu'
import { getSectionTitle } from '@/components/layout/nav'

export function Header() {
  const pathname = usePathname()
  const section = getSectionTitle(pathname)

  return (
    <header className="no-print sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-subtle-border bg-white/90 px-4 backdrop-blur-sm sm:px-6">
      <div>
        <Caption className="block tracking-wide uppercase">ShopManager</Caption>
        <Heading as="h1" size="lg" className="text-xl leading-tight">
          {section}
        </Heading>
      </div>
      <UserMenu />
    </header>
  )
}
