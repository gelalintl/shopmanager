import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BrandLogo } from '@/components/ui/logo'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { cn } from '@/lib/cn'

export type AppErrorAction = {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'solid' | 'outline' | 'secondary'
}

type AppErrorStateProps = {
  code?: string
  title: string
  message: string
  hint?: string
  variant?: 'missing' | 'failure'
  actions: AppErrorAction[]
  className?: string
}

function WarningMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 3.4 2.8 19.2A1.4 1.4 0 0 0 4 21.2h16a1.4 1.4 0 0 0 1.2-2L12 3.4Z"
        className="fill-soft-cobalt stroke-cobalt"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 9v5.2" className="stroke-cobalt" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="1" className="fill-cobalt" />
    </svg>
  )
}

function MissingIllustration() {
  return (
    <div className="relative mx-auto h-28 w-28" aria-hidden="true">
      <div className="absolute inset-0 rounded-full bg-soft-cobalt" />
      <div className="absolute inset-3 rounded-full border border-soft-cobalt-strong bg-white shadow-sm" />
      <WarningMark className="absolute inset-0 m-auto h-12 w-12" />
    </div>
  )
}

function FailureIllustration() {
  return (
    <div className="relative mx-auto h-28 w-28" aria-hidden="true">
      <div className="absolute inset-0 rounded-[1.75rem] bg-soft-cobalt" />
      <div className="absolute inset-3 rounded-[1.25rem] border border-soft-cobalt-strong bg-white shadow-sm" />
      <svg viewBox="0 0 24 24" className="absolute inset-0 m-auto h-12 w-12" fill="none">
        <rect x="4" y="5" width="16" height="14" rx="2.5" className="stroke-cobalt" strokeWidth="1.6" />
        <path d="M8 10h8M8 13h5" className="stroke-cobalt" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="16.2" cy="16.2" r="3.4" className="fill-white stroke-cobalt" strokeWidth="1.6" />
        <path d="M16.2 14.8v1.7" className="stroke-cobalt" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="16.2" cy="17.8" r="0.7" className="fill-cobalt" />
      </svg>
    </div>
  )
}

export function AppErrorState({
  code,
  title,
  message,
  hint,
  variant = 'failure',
  actions,
  className,
}: AppErrorStateProps) {
  return (
    <div className={cn('flex w-full flex-col items-center justify-center px-4 py-12', className)}>
      <Card className="w-full max-w-lg px-8 py-10 text-center">
        <BrandLogo size="sm" className="mb-8 justify-center" />
        {variant === 'missing' ? <MissingIllustration /> : <FailureIllustration />}
        {code ? (
          <Caption className="mt-5 block tracking-[0.28em] text-cobalt uppercase">{code}</Caption>
        ) : null}
        <Heading as="h1" size="xl" className="mt-2">
          {title}
        </Heading>
        <Text variant="muted" className="mx-auto mt-2 max-w-md">
          {message}
        </Text>
        {hint ? (
          <Caption className="mt-3 block font-mono text-[11px]">{hint}</Caption>
        ) : null}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {actions.map((action) => {
            const button = (
              <Button
                variant={action.variant ?? 'solid'}
                className="min-w-[12rem]"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            )

            if (action.href) {
              return (
                <Link key={action.label} href={action.href} className="inline-flex justify-center">
                  {button}
                </Link>
              )
            }

            return <span key={action.label}>{button}</span>
          })}
        </div>
      </Card>
    </div>
  )
}
