'use client'

import { useEffect, useRef, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Caption, Text } from '@/components/ui/typography'
import { cn } from '@/lib/cn'
import { roleLabels } from '@/lib/auth'

function initialsFrom(name?: string | null, pseudo?: string | null) {
  const source = name?.trim() || pseudo?.trim() || '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function UserMenu() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const user = session?.user
  const displayName = user?.name || user?.pseudo || 'Utilisateur'
  const role = user?.role ? roleLabels[user.role] ?? user.role : '—'
  const company = user?.companyName || '—'

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointer)
    return () => document.removeEventListener('mousedown', handlePointer)
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex items-center gap-3 rounded-full py-1 pr-2 pl-1',
          'transition-all duration-200 hover:bg-soft-cobalt',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cobalt text-sm font-bold text-white">
          {initialsFrom(user?.name, user?.pseudo)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-bold leading-tight text-foreground">
            {displayName}
          </span>
          <Caption className="leading-tight">{role}</Caption>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm"
        >
          <Text weight="bold">{displayName}</Text>
          <Caption className="mt-0.5 block">{role}</Caption>
          <Caption className="mt-1 block text-cobalt">{company}</Caption>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            Déconnexion
          </Button>
        </div>
      ) : null}
    </div>
  )
}
