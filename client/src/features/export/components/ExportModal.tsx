import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { editorApi } from '@/features/slide-editor/api/editor.api'
import { SlideView } from '@/features/presentation/components/SlideView'
import type { Lecture, LectureSummary, Slide } from '@/lib/types'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  lecture: Lecture | LectureSummary | null
  initialSlideIndex?: number
  onSuccess?: (msg: string) => void
  onError?: (msg: string) => void
}

const EXPORT_WIDTH = 1280
const EXPORT_HEIGHT = 720

const waitForPaint = () =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 80)))

// SRS UC029: xuất slide hiện tại ra 1 ảnh PNG hoặc toàn bộ bài giảng ra 1 file PDF
export const ExportModal = ({
  open,
  onClose,
  lecture,
  initialSlideIndex = 0,
  onSuccess,
  onError
}: ExportModalProps) => {
  const [isExporting, setIsExporting] = useState(false)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const [captureSlide, setCaptureSlide] = useState<Slide | null>(null)
  const [captureTheme, setCaptureTheme] = useState<string | undefined>()
  const captureRef = useRef<HTMLDivElement>(null)
  const fontEmbedCssRef = useRef(new Map<string, Promise<string>>())
  const exportInFlightRef = useRef(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (!exportInFlightRef.current) onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose])

  if (!open || !lecture) return null

  const slideCount =
    'slides' in lecture ? lecture.slides.length : lecture.slideCount
  const currentIndex = Math.min(initialSlideIndex, Math.max(slideCount - 1, 0))
  const cleanTitle = (lecture.title || 'bai-giang')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .trim()

  // Render ngầm slide bằng bộ dựng chỉ đọc (không có viền chọn, nút chỉnh sửa) rồi chụp thành ảnh
  const captureToPng = async (
    slide: Slide,
    pixelRatio: number,
    theme?: string
  ) => {
    const { toPng, getFontEmbedCSS } = await import('html-to-image')
    flushSync(() => {
      setCaptureSlide(slide)
      setCaptureTheme(theme)
    })
    await document.fonts?.ready
    await waitForPaint()
    const node = captureRef.current?.firstElementChild as HTMLElement | null
    if (!node) throw new Error('Không render được slide để xuất')
    const textElements = [node, ...node.querySelectorAll<HTMLElement>('*')]
    await Promise.all(
      textElements
        .filter((element) => element.textContent?.trim())
        .map(async (element) => {
          const style = getComputedStyle(element)
          const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
          await document.fonts.load(font, element.textContent!.normalize('NFC'))
        })
    )
    await Promise.all(
      [...node.querySelectorAll('img')].map((img) => img.decode())
    )
    await document.fonts.ready
    // Different slides can use different fonts. Reuse CSS only for matching font sets.
    const fontKey = [
      ...new Set(
        [node, ...node.querySelectorAll('*')]
          .filter((element) => element instanceof HTMLElement)
          .map(
            (element) =>
              element.style.fontFamily || getComputedStyle(element).fontFamily
          )
      )
    ]
      .sort()
      .join('\n')
    let fontEmbedCSS = fontEmbedCssRef.current.get(fontKey)
    if (!fontEmbedCSS) {
      fontEmbedCSS = getFontEmbedCSS(node)
      fontEmbedCssRef.current.set(fontKey, fontEmbedCSS)
    }
    return toPng(node, {
      pixelRatio,
      cacheBust: true,
      fontEmbedCSS: await fontEmbedCSS
    })
  }

  const run = async (
    task: (fullLecture: Lecture) => Promise<void>,
    errorMsg: string
  ) => {
    if (exportInFlightRef.current) return
    exportInFlightRef.current = true
    try {
      setIsExporting(true)
      setProgressMessage('Đang chuẩn bị file...')
      fontEmbedCssRef.current.clear()
      const fullLecture =
        'slides' in lecture ? lecture : await editorApi.get(lecture._id)
      await task(fullLecture)
      onSuccess?.('Tải xuống thành công')
      onClose()
    } catch {
      onError?.(errorMsg)
    } finally {
      exportInFlightRef.current = false
      setCaptureSlide(null)
      setIsExporting(false)
      setProgressMessage(null)
    }
  }

  const handleExportPng = () =>
    run(async (fullLecture) => {
      const index = Math.min(
        currentIndex,
        Math.max(fullLecture.slides.length - 1, 0)
      )
      const dataUrl = await captureToPng(
        fullLecture.slides[index],
        2,
        fullLecture.theme
      )
      const link = document.createElement('a')
      link.download = `${cleanTitle}-slide-${currentIndex + 1}.png`
      link.href = dataUrl
      link.click()
    }, 'Không thể xuất ảnh PNG cho slide này')

  const handleExportPdf = () =>
    run(async (fullLecture) => {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [EXPORT_WIDTH, EXPORT_HEIGHT]
      })
      for (let i = 0; i < fullLecture.slides.length; i++) {
        setProgressMessage(
          `Đang chuẩn bị file... (${i + 1}/${fullLecture.slides.length})`
        )
        const dataUrl = await captureToPng(
          fullLecture.slides[i],
          1.5,
          fullLecture.theme
        )
        if (i > 0) pdf.addPage([EXPORT_WIDTH, EXPORT_HEIGHT], 'landscape')
        pdf.addImage(
          dataUrl,
          'PNG',
          0,
          0,
          EXPORT_WIDTH,
          EXPORT_HEIGHT,
          undefined,
          'FAST'
        )
      }
      pdf.save(`${cleanTitle}.pdf`)
    }, 'Không thể xuất tệp PDF bài giảng')

  const disabled = isExporting || slideCount === 0

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs font-sans'
      onClick={() => {
        if (!exportInFlightRef.current) onClose()
      }}
    >
      <div
        className='w-full max-w-lg border border-stone-300 bg-white p-6 shadow-2xl'
        onClick={(e) => e.stopPropagation()}
        role='dialog'
        aria-modal='true'
        aria-label='Xuất bài giảng'
      >
        <div className='mb-5 flex items-center justify-between border-b border-stone-200 pb-3.5'>
          <div>
            <h2 className='text-2xl font-medium text-emerald-950 font-display'>
              Xuất bài giảng
            </h2>
            <p className='mt-0.5 max-w-sm truncate text-xs text-stone-500'>
              Bài giảng:{' '}
              <strong className='font-semibold text-stone-800'>
                {lecture.title}
              </strong>
            </p>
          </div>
          {!isExporting && (
            <button
              className='px-2 py-1 text-lg text-stone-400 transition hover:text-stone-700'
              onClick={onClose}
              type='button'
              aria-label='Đóng'
            >
              ✕
            </button>
          )}
        </div>

        {isExporting && (
          <div
            role='status'
            className='mb-5 flex items-center gap-3 border border-orange-400 bg-orange-50 p-3.5 text-xs font-bold text-orange-950'
          >
            <span className='text-lg'>⏳</span>
            <p>{progressMessage}</p>
          </div>
        )}

        {slideCount === 0 && (
          <p className='mb-4 text-xs font-semibold text-red-700'>
            Bài giảng chưa có slide nào để xuất.
          </p>
        )}

        <div className='space-y-3'>
          <button
            type='button'
            disabled={disabled}
            onClick={() => void handleExportPng()}
            className='flex w-full items-start gap-3 border border-stone-300 bg-stone-50/60 p-4 text-left transition hover:border-stone-500 disabled:opacity-50'
          >
            <span className='text-3xl'>🖼️</span>
            <span>
              <span className='block text-sm font-bold text-emerald-950'>
                Xuất slide hiện tại
              </span>
              <span className='mt-1 block text-xs text-stone-500'>
                Slide {currentIndex + 1} thành 1 file ảnh PNG.
              </span>
            </span>
          </button>

          <button
            type='button'
            disabled={disabled}
            onClick={() => void handleExportPdf()}
            className='flex w-full items-start gap-3 border-2 border-orange-600/40 bg-orange-50/30 p-4 text-left transition hover:border-orange-600 disabled:opacity-50'
          >
            <span className='text-3xl'>📄</span>
            <span>
              <span className='block text-sm font-bold text-orange-950'>
                Xuất toàn bộ bài giảng
              </span>
              <span className='mt-1 block text-xs text-stone-500'>
                {slideCount} slide gộp thành 1 file PDF tỉ lệ 16:9.
              </span>
            </span>
          </button>
        </div>

        <div className='mt-6 flex justify-end border-t border-stone-200 pt-3'>
          <button
            type='button'
            disabled={isExporting}
            onClick={onClose}
            className='border border-stone-300 bg-stone-100 px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-200 disabled:opacity-50'
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Vùng render ngầm ngoài màn hình để chụp slide */}
      <div
        ref={captureRef}
        aria-hidden='true'
        style={{ position: 'fixed', left: -99999, top: 0 }}
      >
        {captureSlide && (
          <SlideView
            slide={captureSlide}
            lectureTheme={captureTheme}
            style={{ width: EXPORT_WIDTH, height: EXPORT_HEIGHT }}
          />
        )}
      </div>
    </div>
  )
}
