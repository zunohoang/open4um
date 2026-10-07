import { Modal } from '@/components/ui/Modal'
import type { Outline } from '@/lib/types'
import { FileText, ListTree, Sparkles, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'

interface OutlineModalProps {
  open: boolean
  onClose: () => void
  outline?: Outline | null
  lectureTitle?: string
  isLoading?: boolean
  onRegenerateOutline?: () => Promise<void> | void
}

const OUTLINE_LOADING_STEPS = [
  'Đang phân tích cấu trúc bài giảng...',
  'Đang phân bổ các chương mục theo cấu trúc logic...',
  'Đang đúc kết các luận điểm và ý chính (bullets)...',
  'Đang hoàn tất cấu trúc dàn ý bài giảng...'
]

export const OutlineModal = ({
  open,
  onClose,
  outline,
  lectureTitle,
  isLoading = false,
  onRegenerateOutline
}: OutlineModalProps) => {
  const [loadingStepIdx, setLoadingStepIdx] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      setLoadingStepIdx(0)
      return
    }
    const interval = setInterval(() => {
      setLoadingStepIdx((prev) => (prev + 1) % OUTLINE_LOADING_STEPS.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [isLoading])

  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} title='Dàn ý bài giảng (Outline)'>
      <div className='max-h-[72vh] overflow-y-auto pr-1 space-y-4 font-sans text-stone-800 custom-scrollbar'>
        {/* Header Thông Tin Dàn Ý */}
        <div className='flex items-center justify-between gap-2 border-b border-stone-100 pb-3'>
          <div className='flex items-center gap-2.5 min-w-0'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100/70 text-brand-rust shrink-0'>
              <ListTree size={18} />
            </div>
            <div className='min-w-0'>
              <h3 className='text-xs font-bold text-stone-900 truncate'>
                {outline?.title || lectureTitle || 'Dàn ý bài giảng'}
              </h3>
              <p className='text-[11px] text-stone-400'>
                {isLoading
                  ? 'AI đang tổng hợp và phân cấp bài giảng...'
                  : 'Cấu trúc các chương mục và các ý chính do AI đề xuất'}
              </p>
            </div>
          </div>

          {/* Nút Sinh Lại Dàn Ý Bằng AI (nếu có handler và không đang load) */}
          {onRegenerateOutline && !isLoading && (
            <button
              type='button'
              onClick={() => void onRegenerateOutline()}
              className='flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50/70 px-2.5 py-1.5 text-[11px] font-semibold text-brand-rust hover:bg-orange-100/80 active:scale-95 transition cursor-pointer shrink-0'
              title='Yêu cầu AI phân tích và tạo lại dàn ý'
            >
              <Sparkles size={13} className='text-brand-rust' />
              <span>
                {outline?.sections?.length
                  ? 'Tạo lại với AI'
                  : 'Tạo dàn ý với AI'}
              </span>
            </button>
          )}
        </div>

        {/* 1. MÀN HÌNH LOADING: Hiệu ứng Shimmer Skeleton khi AI đang sinh outline */}
        {isLoading ? (
          <div className='space-y-4 py-1'>
            {/* Thanh trạng thái AI đang phân tích */}
            <div className='relative overflow-hidden rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-orange-50/50 to-stone-50 p-3.5 text-xs shadow-xs'>
              <div className='flex items-center justify-between gap-2'>
                <div className='flex items-center gap-2.5 min-w-0'>
                  <div className='relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-brand-rust to-amber-500 text-white shadow-xs'>
                    <Sparkles size={14} className='animate-pulse' />
                    <span className='absolute -top-0.5 -right-0.5 flex h-2 w-2'>
                      <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75'></span>
                      <span className='relative inline-flex rounded-full h-2 w-2 bg-emerald-500'></span>
                    </span>
                  </div>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1.5 font-bold text-brand-ink text-xs'>
                      <span>{OUTLINE_LOADING_STEPS[loadingStepIdx]}</span>
                      <span className='flex items-center gap-0.5 shrink-0'>
                        <span className='h-1 w-1 rounded-full bg-brand-rust animate-bounce [animation-delay:-0.3s]' />
                        <span className='h-1 w-1 rounded-full bg-brand-rust animate-bounce [animation-delay:-0.15s]' />
                        <span className='h-1 w-1 rounded-full bg-brand-rust animate-bounce' />
                      </span>
                    </div>
                    <p className='text-[10px] text-stone-500'>
                      Đang xử lý bằng mô hình Gemini AI...
                    </p>
                  </div>
                </div>

                <span className='flex items-center gap-1.5 rounded-full bg-amber-100/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-800 shrink-0'>
                  <Loader2 size={11} className='animate-spin' />
                  Đang sinh dàn ý
                </span>
              </div>

              {/* Thanh tiến trình pulsing line */}
              <div className='mt-3 h-1 w-full overflow-hidden rounded-full bg-amber-200/40'>
                <div className='h-full w-full bg-gradient-to-r from-brand-rust via-amber-400 to-emerald-500 animate-pulse' />
              </div>
            </div>

            {/* Các thẻ Section Skeleton giả lập cấu trúc dàn ý cây */}
            <div className='space-y-3'>
              {[
                { titleWidth: 'w-3/5', bullets: 3 },
                { titleWidth: 'w-1/2', bullets: 2 },
                { titleWidth: 'w-2/3', bullets: 4 },
                { titleWidth: 'w-4/7', bullets: 2 }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className='rounded-xl border border-stone-200/70 bg-stone-50/60 p-3.5 space-y-2.5 animate-pulse'
                  style={{ animationDelay: `${idx * 160}ms` }}
                >
                  {/* Skeleton Header: Badge số + Tiêu đề section */}
                  <div className='flex items-center gap-2.5'>
                    <div className='flex h-5 w-5 items-center justify-center rounded-full bg-stone-300 text-[10px] font-mono text-white shrink-0' />
                    <div
                      className={`h-4 ${item.titleWidth} rounded-full bg-stone-300/80`}
                    />
                  </div>

                  {/* Skeleton Bullets */}
                  <div className='space-y-2 pl-7'>
                    {Array.from({ length: item.bullets }).map((_, bIdx) => (
                      <div key={bIdx} className='flex items-center gap-2'>
                        <span className='h-1.5 w-1.5 rounded-full bg-stone-300/60 shrink-0' />
                        <div
                          className='h-2.5 rounded-full bg-stone-200/80'
                          style={{
                            width: `${Math.max(45, 95 - bIdx * 18 - (idx % 2) * 10)}%`
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : outline?.sections && outline.sections.length > 0 ? (
          /* 2. HIỂN THỊ DÀN Ý KHI ĐÃ CÓ DỮ LIỆU */
          <div className='space-y-3'>
            {outline.sections.map((section, idx) => (
              <div
                key={idx}
                className='rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 text-xs space-y-2 transition hover:border-orange-200 hover:bg-stone-50'
              >
                <div className='flex items-center gap-2.5 font-bold text-brand-ink'>
                  <span className='flex h-5 w-5 items-center justify-center rounded-full bg-brand-rust/15 text-[10px] text-brand-rust font-mono shrink-0'>
                    {idx + 1}
                  </span>
                  <span className='text-xs leading-snug'>
                    {section.heading}
                  </span>
                </div>
                {section.bullets && section.bullets.length > 0 && (
                  <ul className='space-y-1.5 pl-7 list-disc text-stone-600 text-[11px] leading-relaxed'>
                    {section.bullets.map((b, bIdx) => (
                      <li key={bIdx}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* 3. TRẠNG THÁI CHƯA CÓ DÀN Ý */
          <div className='flex flex-col items-center justify-center py-10 text-center text-stone-400 space-y-3'>
            <div className='flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-300'>
              <FileText size={28} className='stroke-1' />
            </div>
            <div>
              <p className='text-xs font-semibold text-stone-700'>
                Bài giảng này chưa có dữ liệu dàn ý dạng cây
              </p>
              <p className='text-[11px] text-stone-400 mt-0.5'>
                Bạn có thể yêu cầu AI tự động phân tích và tạo dàn ý bài giảng
                logic ngay bây giờ.
              </p>
            </div>
            {onRegenerateOutline && (
              <button
                type='button'
                onClick={() => void onRegenerateOutline()}
                className='flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-rust to-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:from-brand-rust/90 hover:to-amber-600/90 active:scale-95 transition cursor-pointer'
              >
                <Sparkles size={14} />
                <span>Sinh dàn ý tự động với AI</span>
              </button>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className='flex items-center justify-between pt-3 border-t border-stone-200'>
          <div className='text-[11px] text-stone-400'>
            {outline?.sections?.length
              ? `Tổng số: ${outline.sections.length} chương mục chính`
              : ''}
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-lg border border-stone-300 px-4 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition cursor-pointer'
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  )
}
