import { editorApi } from '@/features/slide-editor/api/editor.api'
import type { Lecture } from '@/lib/types'
import { SlideView } from './SlideView'
import { BrandLogo } from '@/components/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

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

  const routeState = location.state as {
    lecture?: Lecture
    startIndex?: number
    fromEditor?: boolean
  } | null
  const lectureFromState = routeState?.lecture
  const [lecture, setLecture] = useState<Lecture | null>(
    initialLecture || lectureFromState || null
  )
  const [isLoading, setIsLoading] = useState(!lecture)
  const exitingRef = useRef(false)
  // SRS UC018 bước 4: bắt đầu từ slide đang chọn trong editor (mặc định slide đầu tiên)
  const [index, setIndex] = useState(routeState?.startIndex ?? 0)

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
    if (exitingRef.current) return
    exitingRef.current = true
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
    if (onExit) {
      onExit()
    } else {
      if (routeState?.fromEditor && params.id) {
        navigate(-1)
      } else {
        navigate('/library', { replace: true })
      }
    }
  }, [navigate, onExit, params.id, routeState?.fromEditor])

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

  // SRS UC019: tiến tới slide cuối rồi sang màn hình kết thúc (index = số slide); lùi ở slide 1 thì giữ nguyên
  const slideCount = lecture?.slides.length ?? 0
  const goNext = useCallback(
    () => setIndex((value) => Math.min(value + 1, slideCount)),
    [slideCount]
  )
  const goPrev = useCallback(
    () => setIndex((value) => Math.max(value - 1, 0)),
    []
  )

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
        goNext()
      }

      // Các phím lùi slide trước
      if (
        event.key === 'ArrowLeft' ||
        event.key === 'Backspace' ||
        event.key === 'PageUp' ||
        event.key === 'ArrowUp'
      ) {
        goPrev()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lecture, handleExit, goNext, goPrev])

  // Click chuột trái tiến tới slide tiếp theo (đồng thời kích hoạt fullscreen nếu chưa có)
  const handleScreenClick = async () => {
    if (!document.fullscreenElement) {
      await requestFullScreen()
      // Click này chỉ dùng để bật lại fullscreen, không chuyển slide
      if (document.fullscreenElement) return
    }
    goNext()
  }

  // Click chuột phải quay lại slide trước
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    goPrev()
  }

  if (isLoading) {
    return (
      <main className='grid min-h-screen place-items-center bg-black p-6 text-stone-300 font-sans text-sm'>
        <div className='flex flex-col items-center gap-4'>
          <BrandLogo
            variant='mark'
            theme='dark'
            height={48}
            className='animate-pulse'
          />
          <span>Đang tải bài trình chiếu...</span>
        </div>
      </main>
    )
  }

  if (!lecture) {
    return (
      <main className='grid min-h-screen place-items-center bg-black p-6 text-stone-100 font-sans'>
        <div className='flex flex-col items-center text-center'>
          <BrandLogo
            variant='mark'
            theme='dark'
            height={48}
            className='mb-4 opacity-50'
          />
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

  if (!lecture.slides.length) {
    return (
      <main className='grid min-h-screen place-items-center bg-black p-6 font-sans text-stone-100'>
        <div className='text-center'>
          <p>Bài giảng chưa có slide để trình chiếu</p>
          <button
            type='button'
            onClick={handleExit}
            className='mt-4 border border-stone-500 px-4 py-2'
          >
            Quay lại
          </button>
        </div>
      </main>
    )
  }

  if (index >= lecture.slides.length) {
    return (
      <main
        onContextMenu={handleContextMenu}
        className='grid min-h-screen w-screen place-items-center bg-black font-sans text-stone-300 select-none'
      >
        <p className='text-lg'>Kết thúc bài trình chiếu - Bấm Esc để thoát</p>
      </main>
    )
  }

  return (
    <main
      onClick={() => void handleScreenClick()}
      onContextMenu={handleContextMenu}
      className='flex min-h-screen w-screen cursor-default items-center justify-center overflow-hidden bg-black select-none'
    >
      {/* Khung Slide chuẩn tỷ lệ 16:9 tối đa kích thước màn hình */}
      <SlideView
        slide={lecture.slides[index]}
        lectureTheme={lecture.theme}
        style={{
          width: 'min(96vw, calc(96vh * 16 / 9))',
          height: 'min(96vh, calc(96vw * 9 / 16))'
        }}
      />
    </main>
  )
}
