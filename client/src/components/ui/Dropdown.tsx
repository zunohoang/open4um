import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface DropdownOption {
  label: string
  value: string
}

interface DropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  trigger?: ReactNode
}

export const Dropdown = ({
  options,
  value,
  onChange,
  trigger
}: DropdownProps) => {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  return (
    <div className='relative inline-block text-left'>
      <button
        type='button'
        className='rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50'
        onClick={() => setOpen((o) => !o)}
      >
        {trigger ?? selected?.label ?? 'Chọn'}
      </button>
      {open && (
        <div className='absolute z-10 mt-1 w-40 rounded-md border border-gray-200 bg-white shadow-lg'>
          {options.map((option) => (
            <button
              key={option.value}
              type='button'
              className={cn(
                'block w-full px-3 py-2 text-left text-sm hover:bg-gray-50',
                option.value === value && 'bg-blue-50 text-blue-600'
              )}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
