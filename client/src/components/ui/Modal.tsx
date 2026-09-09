import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export const Modal = ({ open, onClose, title, children }: ModalProps) => {
  if (!open) return null
  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs'
      onClick={onClose}
    >
      <div
        className='w-full max-w-md border border-stone-300 bg-white p-6 shadow-xl'
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className='mb-4 flex items-center justify-between border-b border-stone-200 pb-3'>
            <h2 className='text-xl font-medium text-emerald-950'>{title}</h2>
            <button
              className='font-sans text-stone-400 hover:text-stone-700'
              onClick={onClose}
              type='button'
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
