import { BrandLogo } from '@/components/ui/logo'
import { cn } from '@/lib/cn'

type CompanyBrandProps = {
  name: string
  logoPath?: string | null
  size?: 'sm' | 'md'
  showFallbackLabel?: boolean
  className?: string
}

const sizeClass = {
  sm: 'h-12 max-w-[10rem]',
  md: 'h-16 max-w-[12rem]',
}

export function CompanyBrand({
  name,
  logoPath,
  size = 'sm',
  showFallbackLabel = true,
  className,
}: CompanyBrandProps) {
  if (logoPath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoPath}
        alt={name}
        className={cn('w-auto object-contain object-left', sizeClass[size], className)}
      />
    )
  }

  return <BrandLogo size={size} showLabel={showFallbackLabel} className={className} />
}
