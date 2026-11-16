import { useState } from 'react'
import { isAxiosError } from 'axios'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { lectureApi } from '@/features/library/api/lecture.api'
import type { Lecture } from '@/lib/types'

interface CreateLectureModalProps {
  open: boolean
  onClose: () => void
  onDone: (lecture: Lecture) => void
}

// SRS UC021: modal thông tin sơ bộ -> tạo bản ghi -> sang editor kèm màn hình nhập Prompt AI
export const CreateLectureModal = ({
  open,
  onClose,
  onDone
}: CreateLectureModalProps) => {
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const handleClose = () => {
    if (busy) return
    setTitle('')
    onClose()
  }

  const handleCreate = async () => {
    setBusy(true)
    try {
      const created = await lectureApi.createBlank(
        title.trim() || 'Bài giảng mới'
      )
      setTitle('')
      onDone(created)
    } catch (err) {
      showToast(
        (isAxiosError(err) &&
          (err.response?.data as { message?: string })?.message) ||
          'Không thể tạo bài giảng, vui lòng thử lại',
        'error'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title='Tạo bài giảng'>
      <form
        className='font-sans'
        onSubmit={(e) => {
          e.preventDefault()
          void handleCreate()
        }}
      >
        <label
          htmlFor='new-lecture-title'
          className='block text-xs font-bold uppercase tracking-wider text-stone-700'
        >
          Tên bài giảng
        </label>
        <input
          id='new-lecture-title'
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='Ví dụ: Căn bản về NodeJS'
          maxLength={200}
          className='mt-2 w-full border border-stone-300 px-3 py-2 text-sm outline-orange-700'
        />
        <p className='mt-2 text-[11px] text-stone-500'>
          Sau khi tạo, bạn sẽ mô tả nội dung để AI sinh dàn ý và slide.
        </p>
        <div className='mt-6 flex justify-end gap-2'>
          <button
            type='button'
            onClick={handleClose}
            className='border border-stone-300 px-4 py-2 text-xs font-semibold hover:bg-stone-100'
          >
            Hủy
          </button>
          <button
            type='submit'
            disabled={busy}
            className='bg-orange-700 px-4 py-2 text-xs font-bold text-white hover:bg-orange-800 disabled:opacity-50'
          >
            {busy ? 'Đang tạo...' : 'Tạo bài giảng'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
