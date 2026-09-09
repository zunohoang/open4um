import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => (
    <label className='flex flex-col gap-1 text-sm' htmlFor={id}>
      {label && <span className='font-medium text-gray-700'>{label}</span>}
      <input
        ref={ref}
        id={id}
        className={cn(
          'rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100',
          error && 'border-red-500',
          className
        )}
        {...props}
      />
      {error && <span className='text-xs text-red-600'>{error}</span>}
    </label>
  )
)
Input.displayName = 'Input'
