import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  dismissible?: boolean
}

const openModals: symbol[] = []

export const Modal = ({
  open,
  onClose,
  title,
  children,
  dismissible = true
}: ModalProps) => {
  const modalId = useRef(Symbol('modal'))
  useEffect(() => {
    if (!open) return
    const id = modalId.current
    openModals.push(id)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openModals.at(-1) === id) {
        event.preventDefault()
        event.stopPropagation()
        if (dismissible) onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      openModals.splice(openModals.indexOf(id), 1)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, onClose, dismissible])
  if (!open) return null
  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs'
      onClick={() => {
        if (dismissible) onClose()
      }}
    >
      <div
        aria-label={title}
        aria-modal='true'
        className='w-full max-w-md border border-stone-300 bg-white p-6 shadow-xl'
        onClick={(e) => e.stopPropagation()}
        role='dialog'
      >
        {title && (
          <div className='mb-4 flex items-center justify-between border-b border-stone-200 pb-3'>
            <h2 className='text-xl font-medium text-emerald-950'>{title}</h2>
            <button
              className='font-sans text-stone-400 hover:text-stone-700'
              onClick={onClose}
              disabled={!dismissible}
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
