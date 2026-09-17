import { cn } from '@/lib/cn'

type LogoSize = 'sm' | 'md' | 'lg'

type BrandLogoProps = {
  size?: LogoSize
  className?: string
  showLabel?: boolean
}

const sizeMap: Record<LogoSize, { mark: string; title: string; gap: string }> = {
  sm: { mark: 'h-9 w-9', title: 'text-base', gap: 'gap-2' },
  md: { mark: 'h-11 w-11', title: 'text-xl', gap: 'gap-2.5' },
  lg: { mark: 'h-28 w-28', title: 'text-[32px]', gap: 'gap-5' },
}

function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect width="48" height="48" rx="12" className="fill-cobalt" />
      <rect x="10" y="11" width="12" height="12" rx="2.5" className="fill-white" />
      <rect x="26" y="11" width="12" height="7" rx="2.5" className="fill-white/70" />
      <rect x="10" y="27" width="12" height="10" rx="2.5" className="fill-white/85" />
      <rect x="26" y="22" width="12" height="15" rx="2.5" className="fill-white" />
    </svg>
  )
}

export function BrandLogo({ size = 'md', className, showLabel = true }: BrandLogoProps) {
  const scale = sizeMap[size]
  const stacked = size === 'lg'

  return (
    <div
      className={cn(
        'flex items-center font-sans',
        stacked ? 'flex-col text-center' : 'flex-row',
        scale.gap,
        className,
      )}
      aria-label="ShopManager"
    >
      <Mark className={cn('shrink-0', scale.mark)} />
      {showLabel ? (
        <p className={cn('font-bold tracking-tight text-cobalt', scale.title)}>
          ShopManager
        </p>
      ) : null}
    </div>
  )
}
