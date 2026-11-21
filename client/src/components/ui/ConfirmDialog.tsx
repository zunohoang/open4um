import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  secondaryLabel?: string
  onSecondary?: () => void | Promise<void>
  pending?: boolean
}

export const ConfirmDialog = ({
  open,
  title = 'Xác nhận',
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  onConfirm,
  onCancel,
  secondaryLabel,
  onSecondary,
  pending = false
}: ConfirmDialogProps) => {
  const inFlight = useRef(false)
  const [running, setRunning] = useState(false)
  useEffect(() => {
    if (!open) {
      inFlight.current = false
      setRunning(false)
    }
  }, [open])
  const busy = pending || running
  const runAction = async (action: () => void | Promise<void>) => {
    if (inFlight.current || pending) return
    inFlight.current = true
    setRunning(true)
    try {
      await action()
    } finally {
      inFlight.current = false
      setRunning(false)
    }
  }
  return (
    <Modal open={open} onClose={onCancel} title={title} dismissible={!busy}>
      <p className='mb-6 font-sans text-sm text-stone-600'>{message}</p>
      <div className='flex flex-wrap justify-end gap-2 font-sans'>
        {/* Focus vào Hủy (lựa chọn an toàn) để người dùng bàn phím/trình đọc màn hình biết hộp xác nhận đã mở */}
        <button
          autoFocus
          className='border border-stone-300 px-4 py-2 text-xs font-semibold hover:bg-stone-100'
          onClick={onCancel}
          disabled={busy}
          type='button'
        >
          {cancelLabel}
        </button>
        {onSecondary && secondaryLabel && (
          <button
            type='button'
            disabled={busy}
            onClick={() => void runAction(onSecondary)}
            className='border border-stone-300 px-4 py-2 text-xs font-semibold hover:bg-stone-100'
          >
            {secondaryLabel}
          </button>
        )}
        <button
          className='bg-orange-700 px-4 py-2 text-xs font-bold text-white hover:bg-orange-800'
          onClick={() => void runAction(onConfirm)}
          disabled={busy}
          type='button'
        >
          {busy ? 'Đang xử lý...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
