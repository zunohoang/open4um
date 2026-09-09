import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline'
}

export const Button = ({
  variant = 'primary',
  className,
  ...props
}: ButtonProps) => (
  <button
    className={cn(
      'px-4 py-2 text-xs font-sans font-bold uppercase tracking-wider transition disabled:opacity-50',
      variant === 'primary' && 'bg-orange-700 text-white hover:bg-orange-800',
      variant === 'secondary' &&
        'bg-stone-200 text-stone-800 hover:bg-stone-300',
      variant === 'outline' &&
        'border border-stone-400 bg-white text-stone-800 hover:bg-stone-100',
      className
    )}
    {...props}
  />
)
