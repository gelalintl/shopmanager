import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Caption } from '@/components/ui/typography'

export const controlClass =
  'w-full min-h-10 rounded-md border border-subtle-border bg-white px-3 py-2 font-sans text-lg font-normal placeholder:text-foreground-muted/70 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-powder disabled:opacity-70'

export const quietControlClass =
  'w-full min-h-9 rounded-md border border-slate-200 bg-white/80 px-2 py-1.5 font-sans text-sm font-normal text-foreground-muted transition-all duration-200 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200'

type InputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: string
  error?: string
  trailing?: ReactNode
}

export function InputField({
  id,
  label,
  error,
  trailing,
  className,
  disabled,
  ...props
}: InputFieldProps) {
  const fieldId = id ?? props.name
  const errorId = error && fieldId ? `${fieldId}-error` : undefined

  return (
    <div className="flex flex-col">
      <label
        htmlFor={fieldId}
        className="mt-2.5 mb-1 font-sans text-sm font-bold text-foreground"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={fieldId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            controlClass,
            error ? 'border-danger' : undefined,
            trailing ? 'pr-10' : undefined,
            className,
          )}
          {...props}
        />
        {trailing ? (
          <div className="absolute right-2 flex items-center text-foreground-muted">
            {trailing}
          </div>
        ) : null}
      </div>
      {error ? (
        <Caption id={errorId} color="danger" className="mt-1 italic">
          *{error}
        </Caption>
      ) : null}
    </div>
  )
}
