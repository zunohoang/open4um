import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { editorApi } from '@/features/slide-editor/api/editor.api'
import type { Lecture } from '@/lib/types'

interface PresentationPageProps {
  lecture?: Lecture
  onExit?: () => void
}

export const PresentationPage = ({
  lecture: initialLecture,
  onExit
}: PresentationPageProps) => {
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const location = useLocation()

  const lectureFromState = (location.state as { lecture?: Lecture })?.lecture
  const [lecture, setLecture] = useState<Lecture | null>(
    initialLecture || lectureFromState || null
  )
  const [isLoading, setIsLoading] = useState(!lecture)
  const [index, setIndex] = useState(0)
  const slideRef = useRef<HTMLDivElement>(null)

  // Bật chế độ toàn màn hình trình duyệt (True Browser Fullscreen)
  const requestFullScreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.()
      }
    } catch {
      // Bỏ qua nếu trình duyệt yêu cầu user gesture trực tiếp
    }
  }, [])

  // Thoát toàn màn hình và quay về trang trước
  const handleExit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
    if (onExit) {
      onExit()
    } else {
      navigate(-1)
    }
  }, [navigate, onExit])

  // Tự động kích hoạt fullscreen khi vừa vào trang trình chiếu
  useEffect(() => {
    void requestFullScreen()
  }, [requestFullScreen])

  // Lắng nghe sự kiện fullscreenchange: khi người dùng ấn ESC (hoặc thoát fullscreen trình duyệt)
  // tự động đưa người dùng trở lại trang trước mà không cần nút bấm thủ công
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleExit()
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener(
        'webkitfullscreenchange',
        handleFullscreenChange
      )
    }
  }, [handleExit])

  useEffect(() => {
    if (!lecture && params.id) {
      setIsLoading(true)
      void editorApi
        .get(params.id)
        .then((loaded) => setLecture(loaded))
        .catch(() => {})
        .finally(() => setIsLoading(false))
    }
  }, [params.id, lecture])

  // Điều khiển slide bằng bàn phím
  useEffect(() => {
    if (!lecture) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleExit()
        return
      }

      // Các phím tới slide tiếp theo
      if (
        event.key === 'ArrowRight' ||
        event.key === ' ' ||
        event.key === 'Enter' ||
        event.key === 'PageDown' ||
        event.key === 'ArrowDown'
      ) {
        setIndex((value) => Math.min(value + 1, lecture.slides.length - 1))
      }

      // Các phím lùi slide trước
      if (
        event.key === 'ArrowLeft' ||
        event.key === 'Backspace' ||
        event.key === 'PageUp' ||
        event.key === 'ArrowUp'
      ) {
        setIndex((value) => Math.max(value - 1, 0))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lecture, handleExit])

  // Click chuột trái tiến tới slide tiếp theo (đồng thời kích hoạt fullscreen nếu chưa có)
  const handleScreenClick = () => {
    if (!document.fullscreenElement) {
      void requestFullScreen()
    }
    if (!lecture) return
    setIndex((value) => Math.min(value + 1, lecture.slides.length - 1))
  }

  // Click chuột phải quay lại slide trước
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!lecture) return
    setIndex((value) => Math.max(value - 1, 0))
  }

  if (isLoading) {
    return (
      <main className='grid min-h-screen place-items-center bg-black p-6 text-stone-300 font-sans text-sm'>
        Đang tải bài trình chiếu...
      </main>
    )
  }

  if (!lecture) {
    return (
      <main className='grid min-h-screen place-items-center bg-black p-6 text-stone-100 font-sans'>
        <div className='text-center'>
          <p className='text-sm text-red-300'>Không tìm thấy bài giảng</p>
          <button
            type='button'
            className='mt-4 border border-stone-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-stone-200 hover:bg-stone-800'
            onClick={() => navigate('/library')}
          >
            ← Trở về Thư viện
          </button>
        </div>
      </main>
    )
  }

  const slide = lecture.slides[index]
  const slidePattern = slide?.pattern || lecture.pattern || 'default'

  return (
    <main
      onClick={handleScreenClick}
      onContextMenu={handleContextMenu}
      className='flex min-h-screen w-screen cursor-default items-center justify-center overflow-hidden bg-black select-none'
      title='Click chuột trái để tới slide tiếp theo • Click chuột phải để lùi lại • Nhấn ESC để thoát'
    >
      {/* Khung Slide chuẩn tỷ lệ 16:9 tối đa kích thước màn hình */}
      <div
        ref={slideRef}
        className={`relative flex flex-col justify-between p-[6%] sm:p-[7%] shadow-2xl transition-all duration-150 ${
          slidePattern === 'warm'
            ? 'bg-orange-50 text-orange-950'
            : slidePattern === 'mono'
              ? 'bg-stone-900 text-stone-100'
              : 'bg-stone-50 text-emerald-950'
        }`}
        style={{
          aspectRatio: '16 / 9',
          width: 'min(96vw, calc(96vh * 16 / 9))',
          height: 'min(96vh, calc(96vw * 9 / 16))'
        }}
      >
        {/* Số thứ tự slide kín đáo, thanh lịch */}
        <span className='self-end font-mono text-xs opacity-40 select-none'>
          {index + 1} / {lecture.slides.length}
        </span>

        {slide?.components && slide.components.length > 0 ? (
          <div className='relative w-full flex-1'>
            {slide.components.map((comp) => (
              <div
                key={comp.id}
                style={{
                  position: 'absolute',
                  left: `${comp.x}%`,
                  top: `${comp.y}%`,
                  width: comp.width ? `${comp.width}%` : 'auto',
                  maxWidth: '94%',
                  fontSize: `${Math.round((comp.fontSize ?? 20) * 1.3)}px`,
                  fontWeight: comp.fontWeight ?? 'normal',
                  fontStyle: comp.fontStyle ?? 'normal',
                  textDecoration: comp.textDecoration ?? 'none',
                  textAlign: comp.textAlign ?? 'left',
                  color:
                    comp.color ||
                    (slidePattern === 'mono' ? '#f5f5f4' : '#064e3b'),
                  lineHeight: 1.3
                }}
                className={
                  comp.fontFamily === 'display'
                    ? 'font-display'
                    : comp.fontFamily === 'mono'
                      ? 'font-mono'
                      : 'font-sans'
                }
              >
                {comp.type === 'bullets' ? (
                  <ul className='space-y-2.5 list-disc pl-6'>
                    {comp.content
                      .split('\n')
                      .filter((s) => s.trim())
                      .map((bullet, idx) => (
                        <li key={idx}>{bullet}</li>
                      ))}
                  </ul>
                ) : comp.type === 'quote' ? (
                  <div className='italic border-y border-stone-300/40 py-4 px-3 text-xl'>
                    “ {comp.content} ”
                  </div>
                ) : (
                  <div>{comp.content}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className='my-auto w-full'>
            <div
              className={`w-full ${
                slide?.titleAlign === 'center'
                  ? 'text-center'
                  : slide?.titleAlign === 'right'
                    ? 'text-right'
                    : 'text-left'
              }`}
            >
              <h1
                className={`font-medium leading-tight font-display ${
                  slide?.titleSize === 'xl'
                    ? 'text-5xl sm:text-7xl'
                    : slide?.titleSize === 'sm'
                      ? 'text-3xl sm:text-5xl'
                      : 'text-4xl sm:text-6xl'
                }`}
              >
                {slide?.title}
              </h1>
              {slide?.subtitle && (
                <p className='mt-3 font-sans text-xl sm:text-2xl opacity-75'>
                  {slide.subtitle}
                </p>
              )}
            </div>

            {slide?.layout === 'quote' ? (
              <div className='my-8 border-y border-stone-300/40 py-6 text-center font-display text-2xl italic leading-relaxed sm:text-4xl'>
                “ {(slide.bullets ?? []).join(' ')} ”
              </div>
            ) : slide?.layout === 'two-column' ? (
              <div className='mt-8 grid grid-cols-2 gap-8'>
                <div className='space-y-3 border-r border-stone-300/30 pr-4'>
                  {(slide?.bullets ?? [])
                    .slice(0, Math.ceil((slide?.bullets ?? []).length / 2))
                    .map((bullet, idx) => (
                      <div
                        key={idx}
                        className='flex items-start gap-3 font-sans text-base sm:text-xl'
                      >
                        <span className='font-bold text-orange-700'>
                          {slide?.bulletStyle === 'decimal'
                            ? `${idx + 1}.`
                            : slide?.bulletStyle === 'dash'
                              ? '—'
                              : '•'}
                        </span>
                        <span>{bullet}</span>
                      </div>
                    ))}
                </div>
                <div className='space-y-3 pl-2'>
                  {(slide?.bullets ?? [])
                    .slice(Math.ceil((slide?.bullets ?? []).length / 2))
                    .map((bullet, idx) => (
                      <div
                        key={idx}
                        className='flex items-start gap-3 font-sans text-base sm:text-xl'
                      >
                        <span className='font-bold text-orange-700'>
                          {slide?.bulletStyle === 'decimal'
                            ? `${Math.ceil((slide?.bullets ?? []).length / 2) + idx + 1}.`
                            : slide?.bulletStyle === 'dash'
                              ? '—'
                              : '•'}
                        </span>
                        <span>{bullet}</span>
                      </div>
                    ))}
                </div>
              </div>
            ) : slide?.layout === 'headline' ? (
              <div className='mt-8 font-sans text-lg leading-relaxed opacity-80 sm:text-2xl'>
                {(slide?.bullets ?? []).join(' • ')}
              </div>
            ) : (
              <div className='mt-8'>
                {slide?.bulletStyle === 'none' ? (
                  <div className='space-y-3 font-sans text-base leading-relaxed sm:text-xl'>
                    {(slide?.bullets ?? []).map((bullet, idx) => (
                      <p key={idx}>{bullet}</p>
                    ))}
                  </div>
                ) : slide?.bulletStyle === 'decimal' ? (
                  <ol className='list-decimal space-y-3 pl-6 font-sans text-base sm:text-xl'>
                    {(slide?.bullets ?? []).map((bullet, idx) => (
                      <li key={idx}>{bullet}</li>
                    ))}
                  </ol>
                ) : slide?.bulletStyle === 'dash' ? (
                  <div className='space-y-3 font-sans text-base sm:text-xl'>
                    {(slide?.bullets ?? []).map((bullet, idx) => (
                      <div key={idx} className='flex items-start gap-3'>
                        <span className='font-bold text-orange-700'>—</span>
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className='list-disc space-y-3 pl-6 font-sans text-base sm:text-xl'>
                    {(slide?.bullets ?? []).map((bullet, idx) => (
                      <li key={idx}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {slide?.speakerNotes && (
          <div className='mt-4 border-t border-stone-200/20 pt-2 font-sans text-xs italic opacity-40 select-none'>
            📝 {slide.speakerNotes}
          </div>
        )}
      </div>
    </main>
  )
}
