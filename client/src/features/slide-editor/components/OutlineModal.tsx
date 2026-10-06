import { Modal } from '@/components/ui/Modal'
import type { Outline } from '@/lib/types'
import { FileText, ListTree } from 'lucide-react'

interface OutlineModalProps {
  open: boolean
  onClose: () => void
  outline?: Outline | null
  lectureTitle?: string
}

export const OutlineModal = ({
  open,
  onClose,
  outline,
  lectureTitle
}: OutlineModalProps) => {
  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} title='Dàn ý bài giảng (Outline)'>
      <div className='max-h-[70vh] overflow-y-auto pr-1 space-y-4 font-sans text-stone-800 custom-scrollbar'>
        <div className='flex items-center gap-2 border-b border-stone-100 pb-3'>
          <ListTree size={18} className='text-brand-rust shrink-0' />
          <div>
            <h3 className='text-xs font-bold text-stone-900'>
              {outline?.title || lectureTitle || 'Dàn ý bài giảng'}
            </h3>
            <p className='text-[11px] text-stone-400'>
              Cấu trúc các chương mục và các ý chính do AI đề xuất ban đầu
            </p>
          </div>
        </div>

        {outline?.sections && outline.sections.length > 0 ? (
          <div className='space-y-3'>
            {outline.sections.map((section, idx) => (
              <div
                key={idx}
                className='rounded-lg border border-stone-200 bg-stone-50/60 p-3 text-xs space-y-1.5'
              >
                <div className='flex items-center gap-2 font-bold text-brand-ink'>
                  <span className='flex h-5 w-5 items-center justify-center rounded-full bg-brand-rust/15 text-[10px] text-brand-rust font-mono shrink-0'>
                    {idx + 1}
                  </span>
                  <span>{section.heading}</span>
                </div>
                {section.bullets && section.bullets.length > 0 && (
                  <ul className='space-y-1 pl-7 list-disc text-stone-600 text-[11px] leading-relaxed'>
                    {section.bullets.map((b, bIdx) => (
                      <li key={bIdx}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center py-8 text-center text-stone-400'>
            <FileText size={32} className='stroke-1 text-stone-300 mb-2' />
            <p className='text-xs font-medium'>
              Bài giảng này chưa có dữ liệu dàn ý dạng cây.
            </p>
          </div>
        )}

        <div className='flex justify-end pt-2 border-t border-stone-200'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-lg border border-stone-300 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition cursor-pointer'
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  )
}
