import { cn } from '@/lib/cn'

type CompanyBrandProps = {
  name: string
  logoPath?: string | null
  logoUrl?: string | null
  size?: 'sm' | 'md'
  align?: 'left' | 'center'
  className?: string
}

const imageSize = {
  sm: 'h-12 max-w-[10rem]',
  md: 'h-16 max-w-[12rem]',
}

export function CompanyBrand({
  name,
  logoPath,
  logoUrl,
  size = 'sm',
  align = 'left',
  className,
}: CompanyBrandProps) {
  const src = (logoPath || logoUrl || '').trim()
  const centered = align === 'center'

  if (!src.startsWith('data:image/')) {
    return null
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={cn(
        'w-auto object-contain',
        centered ? 'mx-auto object-center' : 'object-left',
        imageSize[size],
        className,
      )}
    />
  )
}

export function PrintCopyBadge({ label, className }: { label: string; className?: string }) {
  return (
    <p
      className={cn(
        'inline-flex rounded-full border border-cobalt bg-soft-cobalt px-3 py-0.5',
        'text-[10px] font-bold tracking-[0.14em] text-cobalt uppercase',
        className,
      )}
    >
      {label}
    </p>
  )
}

export function PrintGeneratedBy({ className }: { className?: string }) {
  return <p className={cn('text-[9px] text-gray-400', className)}>Généré par ShopManager</p>
}

export function PrintCutLine({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'pos-cut-rule my-4 text-center text-[10px] tracking-wide text-gray-400 print:my-0',
        className,
      )}
    >
      ------------------ DÉCOUPE CAISSE ------------------
    </p>
  )
}
