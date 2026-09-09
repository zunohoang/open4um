import { useState } from 'react'
import { exportLectureToPdf, exportSlideToPng } from '@/lib/exportUtils'
import type { Lecture } from '@/lib/types'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  lecture: Lecture | null
  initialSlideIndex?: number
  onSuccess?: (msg: string) => void
  onError?: (msg: string) => void
}

export const ExportModal = ({
  open,
  onClose,
  lecture,
  initialSlideIndex = 0,
  onSuccess,
  onError
}: ExportModalProps) => {
  const [selectedSlideIndex, setSelectedSlideIndex] =
    useState<number>(initialSlideIndex)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportType, setExportType] = useState<'png' | 'pdf' | null>(null)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)

  if (!open || !lecture) return null

  const cleanTitle = (lecture.title || 'bai-giang')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .trim()

  const handleExportPng = async () => {
    try {
      setIsExporting(true)
      setExportType('png')
      setProgressMessage('Đang xử lý ảnh PNG...')

      const slide = lecture.slides[selectedSlideIndex] || lecture.slides[0]
      const filename = `${cleanTitle}-slide-${selectedSlideIndex + 1}`

      await exportSlideToPng(
        slide,
        lecture.pattern,
        selectedSlideIndex,
        lecture.slides.length,
        filename
      )

      onSuccess?.(`Đã xuất slide ${selectedSlideIndex + 1} thành công (PNG)`)
      onClose()
    } catch {
      onError?.('Không thể xuất ảnh PNG cho slide này')
    } finally {
      setIsExporting(false)
      setExportType(null)
      setProgressMessage(null)
    }
  }

  const handleExportPdf = async () => {
    try {
      setIsExporting(true)
      setExportType('pdf')
      setProgressMessage('Đang khởi tạo PDF...')

      await exportLectureToPdf(lecture, (current, total) => {
        setProgressMessage(
          `Đang gộp slide vào PDF: Trang ${current}/${total}...`
        )
      })

      onSuccess?.(
        `Đã xuất toàn bộ ${lecture.slides.length} slide thành PDF thành công!`
      )
      onClose()
    } catch {
      onError?.('Không thể xuất tệp PDF bài giảng')
    } finally {
      setIsExporting(false)
      setExportType(null)
      setProgressMessage(null)
    }
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs font-sans'
      onClick={() => {
        if (!isExporting) onClose()
      }}
    >
      <div
        className='w-full max-w-lg border border-stone-300 bg-white p-6 shadow-2xl transition-all'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className='flex items-center justify-between border-b border-stone-200 pb-3.5 mb-5'>
          <div>
            <h2 className='text-2xl font-medium text-emerald-950 font-display'>
              Xuất bản bài giảng
            </h2>
            <p className='text-xs text-stone-500 mt-0.5 truncate max-w-sm'>
              Bài giảng:{' '}
              <strong className='text-stone-800 font-semibold'>
                {lecture.title}
              </strong>
            </p>
          </div>
          {!isExporting && (
            <button
              className='text-stone-400 hover:text-stone-700 text-lg px-2 py-1 transition'
              onClick={onClose}
              type='button'
              title='Đóng'
            >
              ✕
            </button>
          )}
        </div>

        {/* Thông báo tiến trình xuất */}
        {isExporting && (
          <div className='mb-5 border border-orange-400 bg-orange-50 p-3.5 flex items-center gap-3 text-xs font-bold text-orange-950 animate-pulse'>
            <span className='text-lg'>⏳</span>
            <div className='flex-1'>
              <p>{progressMessage || 'Đang xử lý...'}</p>
              <div className='mt-2 h-1.5 w-full bg-orange-200 overflow-hidden'>
                <div className='h-full bg-orange-700 animate-pulse w-3/4'></div>
              </div>
            </div>
          </div>
        )}

        {/* 2 Lựa chọn xuất bản */}
        <div className='space-y-4'>
          {/* LỰA CHỌN 1: XUẤT ĐƠN SLIDE RA ẢNH PNG */}
          <div className='border border-stone-300 bg-stone-50/60 p-4 transition hover:border-stone-400'>
            <div className='flex items-start gap-3'>
              <div className='text-3xl shrink-0 mt-0.5'>🖼️</div>
              <div className='flex-1 min-w-0'>
                <h3 className='text-sm font-bold text-emerald-950'>
                  Xuất đơn slide (Ảnh PNG)
                </h3>
                <p className='text-xs text-stone-500 mt-1 leading-relaxed'>
                  Xuất một slide riêng lẻ thành file ảnh PNG độ nét cao (2K),
                  phù hợp để đính kèm tài liệu hoặc đăng bài.
                </p>

                {/* Dropdown chọn slide cần xuất */}
                <div className='mt-3'>
                  <label
                    htmlFor='select-slide-to-export'
                    className='block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1'
                  >
                    Chọn slide muốn xuất:
                  </label>
                  <select
                    id='select-slide-to-export'
                    disabled={isExporting}
                    value={selectedSlideIndex}
                    onChange={(e) =>
                      setSelectedSlideIndex(Number(e.target.value))
                    }
                    className='w-full border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-800 outline-orange-700 font-medium'
                  >
                    {lecture.slides.map((s, idx) => (
                      <option key={s.id || idx} value={idx}>
                        Slide {idx + 1}:{' '}
                        {s.title ||
                          s.components?.[0]?.content?.slice(0, 30) ||
                          `Slide ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='mt-3 flex justify-end'>
                  <button
                    type='button'
                    disabled={isExporting}
                    onClick={handleExportPng}
                    className='flex items-center gap-1.5 border border-stone-400 bg-white px-3.5 py-1.5 text-xs font-bold text-stone-800 transition hover:bg-stone-100 hover:border-stone-500 disabled:opacity-50'
                  >
                    <span>
                      {isExporting && exportType === 'png' ? '⏳' : '📥'}
                    </span>
                    <span>Tải ảnh PNG (Slide {selectedSlideIndex + 1})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* LỰA CHỌN 2: XUẤT TOÀN BỘ BÀI GIẢNG RA TỆP PDF */}
          <div className='border-2 border-orange-600/40 bg-orange-50/30 p-4 transition hover:border-orange-600'>
            <div className='flex items-start gap-3'>
              <div className='text-3xl shrink-0 mt-0.5'>📄</div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-sm font-bold text-orange-950'>
                    Xuất toàn bộ bài giảng (Tệp PDF)
                  </h3>
                  <span className='border border-orange-300 bg-orange-100 px-2 py-0.5 font-mono text-[10px] font-bold text-orange-900'>
                    {lecture.slides.length} SLIDES
                  </span>
                </div>
                <p className='text-xs text-stone-500 mt-1 leading-relaxed'>
                  Tự động gộp toàn bộ tất cả{' '}
                  <strong>{lecture.slides.length} slide</strong> thành một tệp
                  tài liệu PDF chuẩn tỉ lệ 16:9, giữ nguyên kiểu chữ, màu sắc và
                  tọa độ canvas.
                </p>

                <div className='mt-3 flex justify-end'>
                  <button
                    type='button'
                    disabled={isExporting}
                    onClick={handleExportPdf}
                    className='flex items-center gap-1.5 bg-orange-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-orange-800 disabled:opacity-50 shadow-xs'
                  >
                    <span>
                      {isExporting && exportType === 'pdf' ? '⏳' : '📥'}
                    </span>
                    <span>Tải tệp PDF ({lecture.slides.length} trang)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Nút Hủy */}
        <div className='mt-6 flex justify-end pt-3 border-t border-stone-200'>
          <button
            type='button'
            disabled={isExporting}
            onClick={onClose}
            className='border border-stone-300 bg-stone-100 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200 disabled:opacity-50 transition'
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
