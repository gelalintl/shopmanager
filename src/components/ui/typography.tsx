import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
type FontWeight = 'normal' | 'bold'
type FontColor = 'default' | 'muted' | 'primary' | 'danger' | 'inverse'

const sizeClass: Record<FontSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-2xl',
  '2xl': 'text-4xl',
}

const weightClass: Record<FontWeight, string> = {
  normal: 'font-normal',
  bold: 'font-bold',
}

const colorClass: Record<FontColor, string> = {
  default: 'text-foreground',
  muted: 'text-foreground-muted',
  primary: 'text-primary',
  danger: 'text-danger',
  inverse: 'text-white',
}

type HeadingLevel = 'h1' | 'h2' | 'h3'

const headingDefaults: Record<HeadingLevel, { size: FontSize; weight: FontWeight }> = {
  h1: { size: '2xl', weight: 'bold' },
  h2: { size: 'xl', weight: 'bold' },
  h3: { size: 'lg', weight: 'bold' },
}

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: HeadingLevel
  size?: FontSize
  weight?: FontWeight
  color?: FontColor
}

export function Heading({
  as = 'h1',
  size,
  weight,
  color = 'default',
  className,
  children,
  ...props
}: HeadingProps) {
  const Tag = as
  const defaults = headingDefaults[as]

  return (
    <Tag
      className={cn(
        'font-sans tracking-tight',
        sizeClass[size ?? defaults.size],
        weightClass[weight ?? defaults.weight],
        colorClass[color],
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

type TextProps = HTMLAttributes<HTMLParagraphElement> & {
  variant?: 'body' | 'muted'
  size?: FontSize
  weight?: FontWeight
  color?: FontColor
}

export function Text({
  variant = 'body',
  size = 'md',
  weight = 'normal',
  color,
  className,
  children,
  ...props
}: TextProps) {
  const resolvedColor = color ?? (variant === 'muted' ? 'muted' : 'default')

  return (
    <p
      className={cn(
        'font-sans',
        sizeClass[size],
        weightClass[weight],
        colorClass[resolvedColor],
        className,
      )}
      {...props}
    >
      {children}
    </p>
  )
}

type CaptionProps = HTMLAttributes<HTMLSpanElement> & {
  size?: FontSize
  weight?: FontWeight
  color?: FontColor
}

export function Caption({
  size = 'xs',
  weight = 'normal',
  color = 'muted',
  className,
  children,
  ...props
}: CaptionProps) {
  return (
    <span
      className={cn(
        'font-sans',
        sizeClass[size],
        weightClass[weight],
        colorClass[color],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
