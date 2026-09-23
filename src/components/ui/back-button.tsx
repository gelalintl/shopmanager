'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/cn'

type BackToListButtonProps = {
  href?: string
  className?: string
}

export function BackToListButton({
  href = '/dashboard/invoices',
  className,
}: BackToListButtonProps) {
  const router = useRouter()

  return (
    <button
      type="button"
      aria-label="Retour à la liste"
      title="Retour"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back()
          return
        }
        router.push(href)
      }}
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-slate-100',
        className,
      )}
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  )
}
