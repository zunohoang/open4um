import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog = ({
  open,
  title = 'Xác nhận',
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  onConfirm,
  onCancel
}: ConfirmDialogProps) => (
  <Modal open={open} onClose={onCancel} title={title}>
    <p className='mb-6 font-sans text-sm text-stone-600'>{message}</p>
    <div className='flex justify-end gap-2 font-sans'>
      <button
        className='border border-stone-300 px-4 py-2 text-xs font-semibold hover:bg-stone-100'
        onClick={onCancel}
        type='button'
      >
        {cancelLabel}
      </button>
      <button
        className='bg-orange-700 px-4 py-2 text-xs font-bold text-white hover:bg-orange-800'
        onClick={onConfirm}
        type='button'
      >
        {confirmLabel}
      </button>
    </div>
  </Modal>
)
