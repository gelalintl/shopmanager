'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/card'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { cn } from '@/lib/cn'

export const HIDE_SUMMARY_CARDS_KEY = 'hide_summary_cards'

type StatsTone = 'default' | 'warning' | 'success'

type StatsCardProps = {
  title: string
  value: string
  hint?: string
  icon?: ReactNode
  tone?: StatsTone
  className?: string
}

const toneClass: Record<StatsTone, string> = {
  default: 'bg-primary/10 text-primary',
  warning: 'bg-amber-50 text-amber-600',
  success: 'bg-emerald-50 text-emerald-600',
}

export function StatsCard({
  title,
  value,
  hint,
  icon,
  tone = 'default',
  className,
}: StatsCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <CardBody className="flex items-start gap-4">
        {icon ? (
          <span
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              toneClass[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <Caption className="font-bold tracking-wide uppercase">{title}</Caption>
          <Heading as="h3" className="mt-1 text-2xl">
            {value}
          </Heading>
          {hint ? (
            <Text variant="muted" size="sm" className="mt-1">
              {hint}
            </Text>
          ) : null}
        </div>
      </CardBody>
    </Card>
  )
}

type SummaryCardsProps = {
  children: ReactNode
  className?: string
}

export function SummaryCards({ children, className }: SummaryCardsProps) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(HIDE_SUMMARY_CARDS_KEY) === 'true')
    } catch {
      setHidden(false)
    }
  }, [])

  function toggle() {
    setHidden((current) => {
      const next = !current
      try {
        window.localStorage.setItem(HIDE_SUMMARY_CARDS_KEY, String(next))
      } catch {
        // private mode / quota
      }
      return next
    })
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-white hover:text-primary"
          aria-pressed={hidden}
          aria-label={hidden ? 'Afficher les cartes récapitulatives' : 'Masquer les cartes récapitulatives'}
          title={hidden ? 'Afficher les cartes' : 'Masquer les cartes'}
        >
          {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>
      {hidden ? null : <div className={className}>{children}</div>}
    </section>
  )
}
