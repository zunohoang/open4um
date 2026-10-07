import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Save, Trash2 } from 'lucide-react'

interface SourceMaterialModalProps {
  open: boolean
  onClose: () => void
  sourceMaterial: string
  onSave: (content: string) => void
}

export const SourceMaterialModal = ({
  open,
  onClose,
  sourceMaterial,
  onSave
}: SourceMaterialModalProps) => {
  const [content, setContent] = useState(sourceMaterial)

  useEffect(() => {
    setContent(sourceMaterial)
  }, [sourceMaterial, open])

  const handleSave = () => {
    onSave(content)
    onClose()
  }

  const handleClear = () => {
    setContent('')
    onSave('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title='Tài liệu nguồn & Ghi chú tham khảo'
    >
      <div className='space-y-4 font-sans text-stone-800'>
        <p className='text-xs leading-relaxed text-stone-500'>
          Dán nội dung bài giảng, giáo trình, trích dẫn hoặc tài liệu nghiên cứu
          vào đây. Trợ lý AI sẽ tự động đọc ngữ cảnh này trong mọi lượt trò
          chuyện và chỉnh sửa slide.
        </p>

        <div className='relative'>
          <textarea
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder='Ví dụ: Đề cương chi tiết, nội dung trích từ tài liệu giảng dạy...'
            className='w-full resize-none rounded-lg border border-stone-300 p-3 text-xs leading-relaxed outline-none transition focus:border-brand-rust focus:ring-1 focus:ring-brand-rust'
          />
          <div className='mt-1 flex justify-between text-[11px] text-stone-400'>
            <span>{content.length} ký tự</span>
            <span>Tối đa 10,000 ký tự</span>
          </div>
        </div>

        <div className='flex items-center justify-end gap-2 pt-2 border-t border-stone-200'>
          {sourceMaterial && (
            <button
              type='button'
              onClick={handleClear}
              className='mr-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition cursor-pointer'
            >
              <Trash2 size={13} />
              <span>Xóa tài liệu</span>
            </button>
          )}
          <button
            type='button'
            onClick={onClose}
            className='rounded-lg border border-stone-300 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition cursor-pointer'
          >
            Đóng
          </button>
          <button
            type='button'
            onClick={handleSave}
            className='flex items-center gap-1.5 rounded-lg bg-brand-rust px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-[#b04f35] transition cursor-pointer'
          >
            <Save size={13} />
            <span>Lưu tài liệu</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
