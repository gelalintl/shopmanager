import type { ReactNode } from 'react'
import { Card, CardBody } from '@/components/ui/card'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { cn } from '@/lib/cn'

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
  default: 'bg-soft-cobalt text-cobalt',
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
