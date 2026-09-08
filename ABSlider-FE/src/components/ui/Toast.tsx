import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode
} from 'react'
import { cn } from '@/lib/cn'

interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastItem['type']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 1

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastItem['type'] = 'info') => {
      const id = nextId++
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => {
        removeToast(id)
      }, 4500)
    },
    [removeToast]
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className='fixed top-5 right-5 z-9999 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0'>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role='alert'
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border p-3.5 shadow-2xl backdrop-blur-md transition-all duration-300 font-sans text-xs sm:text-sm',
              toast.type === 'error' &&
                'border-red-500/50 bg-red-950/95 text-red-100 shadow-red-950/50',
              toast.type === 'success' &&
                'border-emerald-500/50 bg-emerald-950/95 text-emerald-100 shadow-emerald-950/50',
              toast.type === 'info' &&
                'border-stone-600 bg-stone-900/95 text-stone-100 shadow-black/50'
            )}
          >
            <span className='text-base shrink-0 select-none'>
              {toast.type === 'error' && '⚠️'}
              {toast.type === 'success' && '✅'}
              {toast.type === 'info' && 'ℹ️'}
            </span>
            <div className='flex-1 leading-relaxed wrap-break-word font-medium'>
              {toast.message}
            </div>
            <button
              type='button'
              onClick={() => removeToast(toast.id)}
              className='shrink-0 text-stone-400 hover:text-white transition px-1 py-0.5 text-xs'
              aria-label='Đóng thông báo'
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast phải được dùng trong ToastProvider')
  return ctx
}
