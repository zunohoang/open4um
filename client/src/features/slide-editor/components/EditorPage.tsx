import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { editorApi } from '@/features/slide-editor/api/editor.api'
import { ExportModal } from '@/components/ui/ExportModal'
import { useToast } from '@/components/ui/Toast'
import type { Lecture, Slide, SlideComponent } from '@/lib/types'

interface EditorPageProps {
  initialLecture?: Lecture
  onBack?: () => void
  onPresent?: (lecture: Lecture) => void
}

const AI_SUGGESTIONS = [
  'Rút gọn thành 3 ý chính súc tích',
  'Thêm ví dụ thực tế minh họa',
  'Viết lại với giọng điệu trang trọng',
  'Tóm tắt kết luận ngắn gọn, dễ nhớ'
]

const COLOR_SWATCHES = [
  { name: 'Đen than', value: '#1c1917' },
  { name: 'Xanh rừng', value: '#064e3b' },
  { name: 'Cam đất', value: '#c2410c' },
  { name: 'Xám đá', value: '#78716c' },
  { name: 'Trắng', value: '#ffffff' },
  { name: 'Đỏ rượu', value: '#991b1b' }
]

// Hàm chuyển đổi/khởi tạo component kéo thả từ dữ liệu slide
const getSlideComponents = (slide: Slide): SlideComponent[] => {
  if (slide.components && slide.components.length > 0) {
    return slide.components
  }

  const comps: SlideComponent[] = []

  // 1. Tiêu đề
  comps.push({
    id: `title-${slide.id}`,
    type: 'title',
    content: slide.title || 'Tiêu đề slide',
    x: 8,
    y: 12,
    width: 84,
    fontSize:
      slide.titleSize === 'xl' ? 52 : slide.titleSize === 'sm' ? 28 : 40,
    fontWeight: 'bold',
    fontStyle: 'normal',
    textDecoration: 'none',
    textAlign: slide.titleAlign || 'left',
    fontFamily: 'display',
    color: '#064e3b'
  })

  // 2. Phụ đề nếu có
  if (slide.subtitle) {
    comps.push({
      id: `sub-${slide.id}`,
      type: 'subtitle',
      content: slide.subtitle,
      x: 8,
      y: 26,
      width: 84,
      fontSize: 18,
      fontWeight: 'normal',
      fontStyle: 'italic',
      textDecoration: 'none',
      textAlign: slide.titleAlign || 'left',
      fontFamily: 'sans',
      color: '#78716c'
    })
  }

  // 3. Nội dung chính / Bullets
  if (slide.bullets && slide.bullets.length > 0) {
    comps.push({
      id: `bullets-${slide.id}`,
      type: 'bullets',
      content: slide.bullets.join('\n'),
      x: 8,
      y: slide.subtitle ? 38 : 28,
      width: 84,
      fontSize: 20,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left',
      fontFamily: 'sans',
      color: '#1c1917'
    })
  }

  return comps
}

export const EditorPage = ({
  initialLecture,
  onBack,
  onPresent
}: EditorPageProps) => {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const location = useLocation()

  const lectureFromState = (location.state as { lecture?: Lecture })?.lecture

  const [lecture, setLecture] = useState<Lecture | null>(
    initialLecture || lectureFromState || null
  )
  const [isLoading, setIsLoading] = useState(!lecture)
  const [active, setActive] = useState(0)
  const [instruction, setInstruction] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)

  // Tab bảng điều khiển bên phải: Chat AI hay Chỉnh sửa Canvas
  const [rightPanelTab, setRightPanelTab] = useState<'chat' | 'edit'>('edit')

  // Component đang được chọn trên Canvas
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null)

  // Trạng thái kéo thả Canvas
  const [dragState, setDragState] = useState<{
    compId: string
    startX: number
    startY: number
    initialCompX: number
    initialCompY: number
  } | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)

  // HỆ THỐNG AUTOSAVE CÓ BẬT/TẮT & ĐẾM NGƯỢC 2S
  // Mặc định là TẮT (false) mỗi phiên làm việc
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [status, setStatus] = useState<'Đã lưu' | 'Chưa lưu' | 'Đang lưu...'>(
    'Đã lưu'
  )

  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  const showSuccess = (msg: string) => {
    showToast(msg, 'success')
  }

  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  )

  // Ref lưu bản mới nhất của lecture để dùng trong timer
  const lectureRef = useRef(lecture)
  useEffect(() => {
    lectureRef.current = lecture
  }, [lecture])

  // Tự động tải bài giảng từ URL param id nếu chưa có sẵn
  useEffect(() => {
    if (!lecture && params.id) {
      setIsLoading(true)
      void editorApi
        .get(params.id)
        .then((loaded) => {
          setLecture(loaded)
        })
        .catch(() => {
          showToast('Không thể tải bài giảng từ máy chủ', 'error')
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [params.id, lecture, showToast])

  // Hàm thực hiện lưu bài giảng lên máy chủ
  const triggerSaveToServer = useCallback(
    async (toSave: Lecture) => {
      setStatus('Đang lưu...')
      setCountdown(null)
      try {
        await editorApi.autosave(toSave)
        setStatus('Đã lưu')
        setHasUnsavedChanges(false)
      } catch {
        setStatus('Chưa lưu')
        showToast('Không thể lưu thay đổi vào máy chủ', 'error')
      }
    },
    [showToast]
  )

  // Xóa các timer đếm ngược
  const clearCountdownTimers = useCallback(() => {
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    setCountdown(null)
  }, [])

  // Khi có thay đổi dữ liệu slide/lecture
  const onLectureMutated = useCallback(
    (next: Lecture) => {
      setLecture(next)
      setHasUnsavedChanges(true)

      // Nếu TẮT tự động lưu: chỉ đánh dấu chưa lưu, không hẹn giờ
      if (!isAutosaveEnabled) {
        setStatus('Chưa lưu')
        clearCountdownTimers()
        return
      }

      // Nếu BẬT tự động lưu: reset và kích hoạt đếm ngược 2s
      clearCountdownTimers()
      setCountdown(2)
      setStatus('Chưa lưu')

      // Cập nhật số giây đếm ngược: 2 -> 1
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) return 1
          return prev - 1
        })
      }, 1000)

      // Sau 2s thì tiến hành gửi request lưu
      countdownTimerRef.current = setTimeout(() => {
        clearCountdownTimers()
        if (lectureRef.current) {
          void triggerSaveToServer(lectureRef.current)
        }
      }, 2000)
    },
    [clearCountdownTimers, isAutosaveEnabled, triggerSaveToServer]
  )

  // Lưu thủ công (khi ấn nút hoặc phím tắt Ctrl+S)
  const handleManualSave = useCallback(() => {
    if (!lecture) return
    clearCountdownTimers()
    void triggerSaveToServer(lecture)
  }, [clearCountdownTimers, lecture, triggerSaveToServer])

  // Lắng nghe phím tắt Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleManualSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleManualSave])

  // Dọn dẹp timer khi unmount
  useEffect(() => {
    return () => clearCountdownTimers()
  }, [clearCountdownTimers])

  // THAO TÁC COMPONENT VÀ CANVAS KÉO THẢ
  const slide = lecture?.slides[active]
  const currentComponents = slide ? getSlideComponents(slide) : []
  const selectedComponent = currentComponents.find(
    (c) => c.id === selectedCompId
  )

  // Cập nhật một hoặc nhiều thuộc tính của component
  const updateComponent = useCallback(
    (
      compId: string,
      patch: Partial<SlideComponent>,
      sourceSlide = lectureRef.current?.slides[active]
    ) => {
      const currentLecture = lectureRef.current
      if (!currentLecture || !sourceSlide) return
      const comps = getSlideComponents(sourceSlide)
      const updatedComps = comps.map((c) =>
        c.id === compId ? { ...c, ...patch } : c
      )

      // Đồng bộ ngược lại title và bullets để AI Edit và Presentation cũ vẫn hoạt động chuẩn
      const titleComp = updatedComps.find((c) => c.type === 'title')
      const subComp = updatedComps.find((c) => c.type === 'subtitle')
      const bulletsComp = updatedComps.find((c) => c.type === 'bullets')

      const updatedSlide: Slide = {
        ...sourceSlide,
        title: titleComp ? titleComp.content : sourceSlide.title,
        subtitle: subComp ? subComp.content : sourceSlide.subtitle,
        bullets: bulletsComp
          ? bulletsComp.content.split('\n').filter((s) => s.trim())
          : sourceSlide.bullets,
        components: updatedComps
      }

      const nextSlides = currentLecture.slides.map((s, idx) =>
        idx === active ? updatedSlide : s
      )
      onLectureMutated({ ...currentLecture, slides: nextSlides })
    },
    [active, onLectureMutated]
  )

  // Thêm component mới vào Canvas
  const addComponent = (type: SlideComponent['type']) => {
    if (!lecture || !slide) return
    const comps = getSlideComponents(slide)
    const newId = `comp-${Date.now()}`

    const newComp: SlideComponent = {
      id: newId,
      type,
      content:
        type === 'title'
          ? 'Tiêu đề mới'
          : type === 'subtitle'
            ? 'Dòng phụ đề mới'
            : type === 'quote'
              ? 'Nhập trích dẫn đáng chú ý tại đây...'
              : 'Nội dung ý mới...',
      x: 12,
      y: 20 + comps.length * 8,
      width: 76,
      fontSize: type === 'title' ? 36 : type === 'subtitle' ? 18 : 20,
      fontWeight: type === 'title' ? 'bold' : 'normal',
      fontStyle: type === 'quote' || type === 'subtitle' ? 'italic' : 'normal',
      textDecoration: 'none',
      textAlign: type === 'quote' ? 'center' : 'left',
      fontFamily: type === 'title' || type === 'quote' ? 'display' : 'sans',
      color: type === 'title' ? '#064e3b' : '#1c1917'
    }

    const updatedComps = [...comps, newComp]
    const updatedSlide: Slide = {
      ...slide,
      components: updatedComps
    }

    const nextSlides = lecture.slides.map((s, idx) =>
      idx === active ? updatedSlide : s
    )
    onLectureMutated({ ...lecture, slides: nextSlides })
    setSelectedCompId(newId)
    setRightPanelTab('edit')
  }

  // Xóa component
  const deleteComponent = (compId: string) => {
    if (!lecture || !slide) return
    const comps = getSlideComponents(slide)
    const updatedComps = comps.filter((c) => c.id !== compId)
    const updatedSlide: Slide = {
      ...slide,
      components: updatedComps
    }
    const nextSlides = lecture.slides.map((s, idx) =>
      idx === active ? updatedSlide : s
    )
    onLectureMutated({ ...lecture, slides: nextSlides })
    if (selectedCompId === compId) setSelectedCompId(null)
  }

  // Nhân bản component
  const duplicateComponent = (comp: SlideComponent) => {
    if (!lecture || !slide) return
    const comps = getSlideComponents(slide)
    const newComp: SlideComponent = {
      ...comp,
      id: `comp-${Date.now()}`,
      x: Math.min(comp.x + 4, 85),
      y: Math.min(comp.y + 4, 85)
    }
    const updatedComps = [...comps, newComp]
    const updatedSlide: Slide = {
      ...slide,
      components: updatedComps
    }
    const nextSlides = lecture.slides.map((s, idx) =>
      idx === active ? updatedSlide : s
    )
    onLectureMutated({ ...lecture, slides: nextSlides })
    setSelectedCompId(newComp.id)
  }

  // Bắt đầu kéo chuột trên component
  const handleComponentMouseDown = (
    e: React.MouseEvent,
    comp: SlideComponent
  ) => {
    e.stopPropagation()
    setSelectedCompId(comp.id)
    setDragState({
      compId: comp.id,
      startX: e.clientX,
      startY: e.clientY,
      initialCompX: comp.x,
      initialCompY: comp.y
    })
  }

  // Lắng nghe di chuyển và thả chuột toàn màn hình khi đang kéo thả
  useEffect(() => {
    if (!dragState || !canvasRef.current) return

    const handleMouseMove = (e: MouseEvent) => {
      const canvasEl = canvasRef.current
      if (!canvasEl) return
      const rect = canvasEl.getBoundingClientRect()

      const deltaX = e.clientX - dragState.startX
      const deltaY = e.clientY - dragState.startY

      const deltaPercentX = (deltaX / rect.width) * 100
      const deltaPercentY = (deltaY / rect.height) * 100

      const nextX = Math.round(
        Math.max(1, Math.min(88, dragState.initialCompX + deltaPercentX))
      )
      const nextY = Math.round(
        Math.max(1, Math.min(88, dragState.initialCompY + deltaPercentY))
      )

      updateComponent(dragState.compId, { x: nextX, y: nextY })
    }

    const handleMouseUp = () => {
      setDragState(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState, updateComponent])

  // Thao tác Slide cơ bản (thêm, xóa, nhân bản, di chuyển)
  const operation = async (body: object) => {
    if (!lecture) return
    try {
      const next = await editorApi.operation(lecture._id, body)
      setLecture(next)
      setActive(Math.min(active, next.slides.length - 1))
      setSelectedCompId(null)
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message ||
          'Không thực hiện được thao tác slide'
        : 'Không thực hiện được thao tác slide'
      showToast(msg, 'error')
    }
  }

  // AI Edit
  const aiEdit = async () => {
    if (!lecture) return
    const currentSlide = lecture.slides[active]
    if (!instruction.trim() || !currentSlide) return
    try {
      setIsAiLoading(true)
      const updated = await editorApi.aiEdit(
        lecture._id,
        currentSlide,
        instruction
      )
      setLecture(updated)
      setInstruction('')
      setStatus('Đã lưu')
      setHasUnsavedChanges(false)
      setSelectedCompId(null)
      showToast('Đã áp dụng chỉnh sửa AI cho slide thành công', 'success')
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message ||
          'Không áp dụng được AI edit'
        : 'Không áp dụng được AI edit'
      showToast(msg, 'error')
    } finally {
      setIsAiLoading(false)
    }
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      navigate(-1)
    }
  }

  const handlePresent = () => {
    if (!lecture) return
    if (onPresent) {
      onPresent(lecture)
    } else {
      navigate(`/presentation/${lecture._id}`, { state: { lecture } })
    }
  }

  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-brand-paper font-sans text-xs font-bold text-stone-600'>
        Đang tải bài giảng...
      </div>
    )
  }

  if (!lecture) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center bg-brand-paper p-6 font-sans'>
        <p className='text-sm font-bold text-red-700'>
          Không tìm thấy bài giảng
        </p>
        <button
          type='button'
          onClick={() => navigate('/library')}
          className='mt-4 bg-orange-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-orange-800'
        >
          ← Trở về Thư viện
        </button>
      </div>
    )
  }

  const slidePattern = slide?.pattern || lecture.pattern || 'default'

  return (
    <main className='min-h-screen bg-stone-200'>
      {/* Header trang soạn thảo màu xanh rừng kinh điển */}
      <header className='flex h-16 items-center gap-4 bg-emerald-950 px-5 text-white sm:px-8 font-sans'>
        <button
          className='text-xs font-bold uppercase tracking-wider text-stone-200 hover:text-white transition'
          onClick={handleBack}
          title='Quay lại thư viện (Hỗ trợ nút chuột Back)'
        >
          ← Thư viện
        </button>

        <span className='text-stone-500'>|</span>

        {/* Tiêu đề bài giảng */}
        <input
          className='max-w-xs sm:max-w-sm border-b border-emerald-700 bg-transparent px-1 py-1 text-sm font-semibold outline-none focus:border-white'
          value={lecture.title}
          onChange={(event) => {
            const next = { ...lecture, title: event.target.value }
            onLectureMutated(next)
          }}
        />

        {/* KHU VỰC ĐIỀU KHIỂN AUTOSAVE & TRẠNG THÁI LƯU */}
        <div className='ml-auto flex items-center gap-3'>
          {/* Nút gạt Bật/Tắt Tự động lưu (Mặc định là TẮT) */}
          <div className='flex items-center gap-2 border border-emerald-800 bg-emerald-900/60 px-3 py-1.5'>
            <span className='text-xs font-medium text-stone-200'>
              Tự động lưu:
            </span>
            <button
              type='button'
              onClick={() => {
                setIsAutosaveEnabled((prev) => !prev)
                clearCountdownTimers()
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                isAutosaveEnabled ? 'bg-orange-600' : 'bg-stone-600'
              }`}
              title={
                isAutosaveEnabled
                  ? 'Đang BẬT tự động lưu (Delay 2s). Nhấn để tắt.'
                  : 'Đang TẮT tự động lưu. Nhấn để bật.'
              }
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  isAutosaveEnabled ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
            <span className='font-mono text-[11px] font-bold text-stone-300'>
              {isAutosaveEnabled ? 'BẬT' : 'TẮT'}
            </span>
          </div>

          {/* Trạng thái đếm ngược hoặc lưu thủ công */}
          {isAutosaveEnabled ? (
            <div className='flex items-center gap-1.5 font-mono text-xs'>
              {countdown !== null ? (
                <span className='animate-pulse font-bold text-orange-400'>
                  ⏳ Lưu sau {countdown}s...
                </span>
              ) : status === 'Đang lưu...' ? (
                <span className='text-emerald-300'>Đang lưu...</span>
              ) : (
                <span className='font-bold text-emerald-400'>✓ Đã lưu</span>
              )}
            </div>
          ) : (
            <div className='flex items-center gap-2'>
              {hasUnsavedChanges ? (
                <button
                  type='button'
                  onClick={handleManualSave}
                  className='bg-orange-700 hover:bg-orange-800 px-3 py-1.5 font-sans text-xs font-bold uppercase tracking-wider text-white shadow-xs transition active:translate-y-0.5'
                  title='Nhấn để lưu hoặc dùng Ctrl+S'
                >
                  💾 Lưu thay đổi
                </button>
              ) : (
                <span className='font-mono text-xs font-bold text-emerald-400'>
                  ✓ Đã lưu
                </span>
              )}
            </div>
          )}

          {/* Nút Mở Modal Xuất bản */}
          <button
            type='button'
            onClick={() => setIsExportModalOpen(true)}
            className='flex items-center gap-1.5 border border-stone-600 bg-stone-800/90 px-3.5 py-1.5 font-sans text-xs font-bold text-stone-200 transition hover:bg-stone-700 hover:text-white'
            title='Mở hộp thoại xuất slide đơn hoặc toàn bộ bài giảng'
          >
            <span>📤</span>
            <span>Xuất bài giảng</span>
          </button>

          {/* Nút Trình chiếu */}
          <button
            className='border border-emerald-600 bg-emerald-900/80 px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition hover:bg-emerald-800'
            onClick={handlePresent}
          >
            Trình chiếu
          </button>
        </div>
      </header>

      {/* Modal Xuất bản bài giảng */}
      <ExportModal
        open={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        lecture={lecture}
        initialSlideIndex={active}
        onSuccess={(msg) => showSuccess(msg)}
        onError={(msg) => showToast(msg, 'error')}
      />

      {/* Cấu trúc 3 cột chuẩn */}
      <div className='flex h-[calc(100vh-4rem)] overflow-hidden bg-brand-paper'>
        {/* Cột 1 (Trái - 240px): Danh sách slide thumbnail dọc sắc nét */}
        <aside className='flex w-60 shrink-0 flex-col overflow-y-auto border-r border-stone-300 bg-stone-100 p-4 font-sans'>
          <button
            className='mb-4 w-full border border-dashed border-orange-700 bg-orange-50/60 px-3 py-2.5 text-xs font-bold text-orange-800 uppercase tracking-wider transition hover:bg-orange-100'
            onClick={() =>
              void operation({ operation: 'add', index: active + 1 })
            }
          >
            + Thêm slide
          </button>

          <div className='flex-1 space-y-2'>
            {lecture.slides.map((item, index) => (
              <button
                className={`w-full border p-3 text-left transition ${
                  index === active
                    ? 'border-orange-700 bg-white font-bold text-emerald-950 shadow-[3px_3px_0_#c2410c]'
                    : 'border-stone-300 bg-stone-50 text-stone-600 hover:border-stone-400 hover:bg-white'
                }`}
                key={item.id}
                onClick={() => {
                  setActive(index)
                  setSelectedCompId(null)
                }}
              >
                <span className='block font-mono text-[10px] text-stone-400'>
                  SLIDE {String(index + 1).padStart(2, '0')}
                </span>
                <strong className='mt-0.5 block truncate text-xs text-stone-900 font-display'>
                  {item.title || 'Slide trống'}
                </strong>
              </button>
            ))}
          </div>
        </aside>

        {/* Cột 2 (Giữa - flex-1): KHUNG CANVAS KÉO THẢ TỰ DO */}
        <section
          className='flex min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto p-8'
          onClick={() => setSelectedCompId(null)}
        >
          {/* Canvas 16:9 với khả năng kéo thả và viền bao khi chọn */}
          <div
            ref={canvasRef}
            className={`relative aspect-video w-full max-w-4xl overflow-hidden border border-stone-300 shadow-2xl transition-all select-none ${
              slidePattern === 'warm'
                ? 'border-t-8 border-orange-900 bg-orange-50 text-orange-950'
                : slidePattern === 'mono'
                  ? 'border-t-8 border-stone-200 bg-stone-900 text-stone-100'
                  : 'border-t-8 border-orange-700 bg-white text-emerald-950'
            }`}
          >
            {/* Chỉ số slide góc trên bên phải canvas */}
            <span className='absolute right-4 top-4 font-mono text-xs opacity-50 z-10 pointer-events-none'>
              {active + 1} / {lecture.slides.length}
            </span>

            {/* Render các component tự do có thể kéo thả */}
            {currentComponents.map((comp) => {
              const isSelected = selectedCompId === comp.id

              return (
                <div
                  key={comp.id}
                  style={{
                    position: 'absolute',
                    left: `${comp.x}%`,
                    top: `${comp.y}%`,
                    width: comp.width ? `${comp.width}%` : 'auto',
                    maxWidth: '94%'
                  }}
                  onMouseDown={(e) => handleComponentMouseDown(e, comp)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedCompId(comp.id)
                  }}
                  className={`group/comp cursor-move transition-shadow ${
                    isSelected
                      ? 'ring-2 ring-orange-600 ring-offset-2 ring-offset-white z-30'
                      : 'hover:ring-1 hover:ring-stone-400 z-20'
                  }`}
                >
                  {/* VIỀN BAO KÍN & 4 CHỐT ĐIỀU KHIỂN KHI SELECT */}
                  {isSelected && (
                    <>
                      {/* 4 chấm góc định vị */}
                      <span className='absolute -top-1.5 -left-1.5 h-3 w-3 border-2 border-white bg-orange-600 shadow-xs pointer-events-none' />
                      <span className='absolute -top-1.5 -right-1.5 h-3 w-3 border-2 border-white bg-orange-600 shadow-xs pointer-events-none' />
                      <span className='absolute -bottom-1.5 -left-1.5 h-3 w-3 border-2 border-white bg-orange-600 shadow-xs pointer-events-none' />
                      <span className='absolute -bottom-1.5 -right-1.5 h-3 w-3 border-2 border-white bg-orange-600 shadow-xs pointer-events-none' />

                      {/* Tag định danh loại component */}
                      <span className='absolute -top-5 left-0 bg-orange-700 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-xs pointer-events-none'>
                        {comp.type === 'title'
                          ? 'Tiêu đề'
                          : comp.type === 'subtitle'
                            ? 'Phụ đề'
                            : comp.type === 'bullets'
                              ? 'Danh sách ý'
                              : comp.type === 'quote'
                                ? 'Trích dẫn'
                                : 'Văn bản'}
                      </span>
                    </>
                  )}

                  {/* NỘI DUNG COMPONENT HIỂN THỊ TRÊN CANVAS */}
                  <div
                    style={{
                      fontSize: `${comp.fontSize ?? 20}px`,
                      fontWeight: comp.fontWeight ?? 'normal',
                      fontStyle: comp.fontStyle ?? 'normal',
                      textDecoration: comp.textDecoration ?? 'none',
                      textAlign: comp.textAlign ?? 'left',
                      color:
                        comp.color ||
                        (slidePattern === 'mono' ? '#f5f5f4' : '#064e3b'),
                      lineHeight: 1.3
                    }}
                    className={`w-full ${
                      comp.fontFamily === 'display'
                        ? 'font-display'
                        : comp.fontFamily === 'mono'
                          ? 'font-mono'
                          : 'font-sans'
                    }`}
                  >
                    {comp.type === 'bullets' ? (
                      <ul className='space-y-1.5 list-disc pl-5'>
                        {comp.content
                          .split('\n')
                          .filter((s) => s.trim())
                          .map((bullet, idx) => (
                            <li key={idx}>{bullet}</li>
                          ))}
                      </ul>
                    ) : comp.type === 'quote' ? (
                      <div className='italic border-y border-stone-300 py-3 px-2'>
                        “ {comp.content} ”
                      </div>
                    ) : (
                      <div>{comp.content}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Thanh công cụ quản lý slide phía dưới canvas */}
          <div className='mt-6 flex flex-wrap justify-center gap-2 font-sans text-xs'>
            <button
              className='border border-stone-400 bg-white px-4 py-2 font-semibold text-stone-700 transition hover:bg-stone-100'
              onClick={() =>
                slide &&
                void operation({ operation: 'duplicate', slideId: slide.id })
              }
            >
              📋 Nhân bản slide
            </button>
            <button
              className='border border-stone-400 bg-white px-4 py-2 font-semibold text-stone-700 transition hover:bg-stone-100 disabled:opacity-40'
              disabled={active === 0}
              onClick={() =>
                slide &&
                void operation({
                  operation: 'move',
                  slideId: slide.id,
                  toIndex: Math.max(0, active - 1)
                })
              }
            >
              ← Di chuyển
            </button>
            <button
              className='border border-stone-400 bg-white px-4 py-2 font-semibold text-stone-700 transition hover:bg-stone-100 disabled:opacity-40'
              disabled={active === lecture.slides.length - 1}
              onClick={() =>
                slide &&
                void operation({
                  operation: 'move',
                  slideId: slide.id,
                  toIndex: Math.min(lecture.slides.length - 1, active + 1)
                })
              }
            >
              Di chuyển →
            </button>
            <button
              className='border border-red-300 bg-white px-4 py-2 font-semibold text-red-700 transition hover:bg-red-50'
              onClick={() =>
                slide &&
                void operation({ operation: 'delete', slideId: slide.id })
              }
            >
              🗑️ Xóa slide
            </button>
          </div>
        </section>

        {/* Cột 3 (Phải - 320px): CHAT PANEL & BẢNG ĐỊNH DẠNG */}
        <aside className='flex w-80 shrink-0 flex-col overflow-hidden border-l border-stone-300 bg-stone-50 font-sans'>
          {/* Header thanh công cụ phải: Căn giữa 2 nút chọn panel */}
          <div className='flex items-center justify-center border-b border-stone-300 bg-white px-4 py-3'>
            {/* Nút chuyển đổi giữa Chat Panel và Edit Panel */}
            <div className='flex border border-stone-300 bg-stone-100 p-0.5'>
              <button
                type='button'
                onClick={() => setRightPanelTab('chat')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold transition ${
                  rightPanelTab === 'chat'
                    ? 'bg-orange-700 text-white shadow-xs'
                    : 'text-stone-600 hover:text-emerald-950'
                }`}
                title='Mở khung trò chuyện / gợi ý với AI'
              >
                <span>🤖 Chat AI</span>
              </button>
              <button
                type='button'
                onClick={() => setRightPanelTab('edit')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold transition ${
                  rightPanelTab === 'edit'
                    ? 'bg-orange-700 text-white shadow-xs'
                    : 'text-stone-600 hover:text-emerald-950'
                }`}
                title='Chỉnh sửa định dạng phần tử trên Canvas'
              >
                <span>✏️ Định dạng</span>
              </button>
            </div>
          </div>

          {/* TAB 1: CHAT PANEL */}
          {rightPanelTab === 'chat' && (
            <div className='flex flex-1 flex-col justify-between overflow-hidden'>
              {/* Phần GIỮA khung bên phải: Card gợi ý & chip lệnh mẫu */}
              <div className='flex flex-1 flex-col items-center justify-center p-5 text-center overflow-y-auto'>
                <div className='w-full border border-stone-300 bg-white p-4 shadow-xs'>
                  <div className='text-2xl mb-1.5'>💡</div>
                  <p className='text-xs font-bold text-stone-700 leading-relaxed'>
                    Nhập chỉ dẫn tự nhiên để AI hoàn thiện nội dung slide.
                  </p>
                  <p className='mt-1 text-[11px] text-stone-400'>
                    AI sẽ phân tích nội dung hiện tại và áp dụng các thay đổi
                    bạn mong muốn.
                  </p>
                </div>

                {/* Các chip lệnh mẫu nhanh */}
                <div className='mt-5 w-full text-left'>
                  <span className='block mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400'>
                    Gợi ý lệnh nhanh:
                  </span>
                  <div className='space-y-1.5'>
                    {AI_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug}
                        type='button'
                        onClick={() => setInstruction(sug)}
                        className='w-full text-left border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-600 transition hover:border-orange-700 hover:bg-orange-50/60'
                      >
                        ✦ {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Phần DƯỚI CÙNG: Input textarea và nút Áp dụng AI */}
              <div className='mt-auto border-t border-stone-300 bg-white p-4'>
                <label
                  htmlFor='ai-instruction-input'
                  className='block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5'
                >
                  Chỉ dẫn cho AI:
                </label>
                <textarea
                  id='ai-instruction-input'
                  className='w-full resize-none border border-stone-300 bg-stone-50 p-2.5 text-xs outline-orange-700 font-sans'
                  rows={3}
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  placeholder='Ví dụ: Rút gọn thành 3 ý chính dễ nhớ...'
                />
                <button
                  type='button'
                  className='mt-2.5 flex w-full items-center justify-center gap-2 bg-orange-700 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-orange-800 active:translate-y-0.5 disabled:opacity-50'
                  onClick={() => void aiEdit()}
                  disabled={!instruction.trim() || isAiLoading}
                >
                  {isAiLoading ? 'Đang phân tích và xử lý...' : 'Áp dụng AI'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: EDIT PANEL (ĐỊNH DẠNG) */}
          {rightPanelTab === 'edit' && (
            <div className='flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans'>
              {selectedComponent ? (
                /* KHI CÓ COMPONENT ĐANG ĐƯỢC CHỌN */
                <div className='space-y-4'>
                  <div className='border-b border-stone-200 pb-2.5 flex items-center justify-between'>
                    <div>
                      <span className='font-bold uppercase tracking-wider text-emerald-950 text-xs block'>
                        Định dạng thành phần
                      </span>
                      <span className='text-[10px] text-stone-400 font-mono'>
                        Vị trí: X: {selectedComponent.x}%, Y:{' '}
                        {selectedComponent.y}%
                      </span>
                    </div>
                    <span className='bg-orange-100 text-orange-900 border border-orange-300 px-2 py-0.5 text-[10px] font-bold uppercase'>
                      {selectedComponent.type}
                    </span>
                  </div>

                  {/* CỠ CHỮ & TĂNG GIẢM */}
                  <div className='border border-stone-300 bg-white p-3 space-y-2'>
                    <span className='block text-[10px] font-bold uppercase tracking-wider text-stone-600'>
                      Cỡ chữ (Font Size)
                    </span>
                    <div className='flex items-center gap-2'>
                      <button
                        type='button'
                        onClick={() =>
                          updateComponent(selectedComponent.id, {
                            fontSize: Math.max(
                              12,
                              (selectedComponent.fontSize ?? 20) - 2
                            )
                          })
                        }
                        className='h-8 w-8 border border-stone-300 bg-stone-100 font-bold hover:bg-stone-200 text-sm'
                        title='Giảm cỡ chữ'
                      >
                        -
                      </button>
                      <input
                        type='number'
                        className='h-8 flex-1 border border-stone-300 px-2 text-center text-xs font-mono font-bold'
                        value={selectedComponent.fontSize ?? 20}
                        onChange={(e) =>
                          updateComponent(selectedComponent.id, {
                            fontSize: Math.max(8, Number(e.target.value) || 20)
                          })
                        }
                      />
                      <button
                        type='button'
                        onClick={() =>
                          updateComponent(selectedComponent.id, {
                            fontSize: Math.min(
                              96,
                              (selectedComponent.fontSize ?? 20) + 2
                            )
                          })
                        }
                        className='h-8 w-8 border border-stone-300 bg-stone-100 font-bold hover:bg-stone-200 text-sm'
                        title='Tăng cỡ chữ'
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* KIỂU CHỮ (BOLD / ITALIC / UNDERLINE) */}
                  <div className='border border-stone-300 bg-white p-3 space-y-2'>
                    <span className='block text-[10px] font-bold uppercase tracking-wider text-stone-600'>
                      Kiểu chữ & Căn lề
                    </span>
                    <div className='grid grid-cols-2 gap-2'>
                      {/* Đậm, Nghiêng, Gạch chân */}
                      <div className='flex border border-stone-300'>
                        <button
                          type='button'
                          onClick={() =>
                            updateComponent(selectedComponent.id, {
                              fontWeight:
                                selectedComponent.fontWeight === 'bold'
                                  ? 'normal'
                                  : 'bold'
                            })
                          }
                          className={`flex-1 py-1.5 text-center font-bold text-xs transition ${
                            selectedComponent.fontWeight === 'bold'
                              ? 'bg-emerald-950 text-white'
                              : 'bg-stone-50 text-stone-700 hover:bg-stone-200'
                          }`}
                          title='In đậm'
                        >
                          B
                        </button>
                        <button
                          type='button'
                          onClick={() =>
                            updateComponent(selectedComponent.id, {
                              fontStyle:
                                selectedComponent.fontStyle === 'italic'
                                  ? 'normal'
                                  : 'italic'
                            })
                          }
                          className={`flex-1 py-1.5 text-center italic font-bold text-xs border-x border-stone-300 transition ${
                            selectedComponent.fontStyle === 'italic'
                              ? 'bg-emerald-950 text-white'
                              : 'bg-stone-50 text-stone-700 hover:bg-stone-200'
                          }`}
                          title='In nghiêng'
                        >
                          I
                        </button>
                        <button
                          type='button'
                          onClick={() =>
                            updateComponent(selectedComponent.id, {
                              textDecoration:
                                selectedComponent.textDecoration === 'underline'
                                  ? 'none'
                                  : 'underline'
                            })
                          }
                          className={`flex-1 py-1.5 text-center underline font-bold text-xs transition ${
                            selectedComponent.textDecoration === 'underline'
                              ? 'bg-emerald-950 text-white'
                              : 'bg-stone-50 text-stone-700 hover:bg-stone-200'
                          }`}
                          title='Gạch chân'
                        >
                          U
                        </button>
                      </div>

                      {/* Căn lề: Trái / Giữa / Phải */}
                      <div className='flex border border-stone-300'>
                        {(['left', 'center', 'right'] as const).map((align) => (
                          <button
                            key={align}
                            type='button'
                            onClick={() =>
                              updateComponent(selectedComponent.id, {
                                textAlign: align
                              })
                            }
                            className={`flex-1 py-1.5 text-center text-xs font-semibold transition ${
                              (selectedComponent.textAlign || 'left') === align
                                ? 'bg-orange-700 text-white font-bold'
                                : 'bg-stone-50 text-stone-600 hover:bg-stone-200'
                            }`}
                            title={
                              align === 'left'
                                ? 'Căn trái'
                                : align === 'center'
                                  ? 'Căn giữa'
                                  : 'Căn phải'
                            }
                          >
                            {align === 'left'
                              ? '⬅'
                              : align === 'center'
                                ? '⬌'
                                : '➡'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* BẢNG MÀU CHỮ & PHÔNG CHỮ */}
                  <div className='border border-stone-300 bg-white p-3 space-y-2.5'>
                    <span className='block text-[10px] font-bold uppercase tracking-wider text-stone-600'>
                      Màu sắc chữ
                    </span>
                    <div className='flex items-center gap-2'>
                      {COLOR_SWATCHES.map((swatch) => (
                        <button
                          key={swatch.value}
                          type='button'
                          onClick={() =>
                            updateComponent(selectedComponent.id, {
                              color: swatch.value
                            })
                          }
                          style={{ backgroundColor: swatch.value }}
                          className={`h-6 w-6 border transition ${
                            selectedComponent.color === swatch.value
                              ? 'ring-2 ring-orange-600 ring-offset-1 border-stone-400'
                              : 'border-stone-300 hover:scale-110'
                          }`}
                          title={swatch.name}
                        />
                      ))}
                    </div>

                    <span className='block text-[10px] font-bold uppercase tracking-wider text-stone-600 pt-1'>
                      Kiểu phông
                    </span>
                    <div className='flex border border-stone-300'>
                      {(['display', 'sans', 'mono'] as const).map((font) => (
                        <button
                          key={font}
                          type='button'
                          onClick={() =>
                            updateComponent(selectedComponent.id, {
                              fontFamily: font
                            })
                          }
                          className={`flex-1 py-1.5 text-center text-[11px] transition ${
                            (selectedComponent.fontFamily || 'sans') === font
                              ? 'bg-emerald-950 text-white font-bold'
                              : 'bg-stone-50 text-stone-600 hover:bg-stone-200'
                          }`}
                        >
                          {font === 'display'
                            ? 'Lora Serif'
                            : font === 'mono'
                              ? 'Mono'
                              : 'Inter Sans'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* NỘI DUNG VĂN BẢN CỦA COMPONENT */}
                  <div className='border border-stone-300 bg-white p-3 space-y-1.5'>
                    <span className='block text-[10px] font-bold uppercase tracking-wider text-stone-600'>
                      Nội dung văn bản
                    </span>
                    <textarea
                      className='w-full border border-stone-300 p-2 text-xs outline-orange-700 font-sans'
                      rows={4}
                      value={selectedComponent.content}
                      onChange={(e) =>
                        updateComponent(selectedComponent.id, {
                          content: e.target.value
                        })
                      }
                      placeholder='Nhập nội dung...'
                    />
                  </div>

                  {/* HÀNH ĐỘNG: NHÂN BẢN & XÓA */}
                  <div className='flex gap-2 pt-1'>
                    <button
                      type='button'
                      onClick={() => duplicateComponent(selectedComponent)}
                      className='flex-1 border border-stone-300 bg-white py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition'
                    >
                      📋 Nhân bản
                    </button>
                    <button
                      type='button'
                      onClick={() => deleteComponent(selectedComponent.id)}
                      className='flex-1 border border-red-300 bg-red-50 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition'
                    >
                      🗑️ Xóa thành phần
                    </button>
                  </div>
                </div>
              ) : (
                /* KHI CHƯA CHỌN COMPONENT NÀO: HIỂN THỊ CÁC NÚT THÊM MỚI VÀ CÀI ĐẶT CHUNG */
                <div className='space-y-4'>
                  <div className='border-b border-stone-200 pb-2.5'>
                    <span className='font-bold uppercase tracking-wider text-emerald-950 text-xs block'>
                      Canvas & Thêm thành phần
                    </span>
                    <p className='text-xs text-stone-500 mt-1'>
                      Click vào bất kỳ phần tử nào trên canvas để kéo thả vị trí
                      hoặc chọn thêm mới bên dưới:
                    </p>
                  </div>

                  {/* CÁC NÚT THÊM COMPONENT MỚI */}
                  <div className='space-y-2'>
                    <button
                      type='button'
                      onClick={() => addComponent('title')}
                      className='flex w-full items-center justify-between border border-stone-300 bg-white p-3 hover:border-orange-700 hover:bg-orange-50/50 transition font-medium'
                    >
                      <span>+ Thêm Tiêu đề (Heading)</span>
                      <span className='text-stone-400 text-[10px] font-mono'>
                        H1
                      </span>
                    </button>
                    <button
                      type='button'
                      onClick={() => addComponent('subtitle')}
                      className='flex w-full items-center justify-between border border-stone-300 bg-white p-3 hover:border-orange-700 hover:bg-orange-50/50 transition font-medium'
                    >
                      <span>+ Thêm Phụ đề (Subtitle)</span>
                      <span className='text-stone-400 text-[10px] font-mono'>
                        H2
                      </span>
                    </button>
                    <button
                      type='button'
                      onClick={() => addComponent('text')}
                      className='flex w-full items-center justify-between border border-stone-300 bg-white p-3 hover:border-orange-700 hover:bg-orange-50/50 transition font-medium'
                    >
                      <span>+ Thêm Đoạn văn bản (Text)</span>
                      <span className='text-stone-400 text-[10px] font-mono'>
                        Paragraph
                      </span>
                    </button>
                    <button
                      type='button'
                      onClick={() => addComponent('bullets')}
                      className='flex w-full items-center justify-between border border-stone-300 bg-white p-3 hover:border-orange-700 hover:bg-orange-50/50 transition font-medium'
                    >
                      <span>+ Thêm Danh sách ý (Bullets)</span>
                      <span className='text-stone-400 text-[10px] font-mono'>
                        List
                      </span>
                    </button>
                    <button
                      type='button'
                      onClick={() => addComponent('quote')}
                      className='flex w-full items-center justify-between border border-stone-300 bg-white p-3 hover:border-orange-700 hover:bg-orange-50/50 transition font-medium'
                    >
                      <span>+ Thêm Khung trích dẫn (Quote)</span>
                      <span className='text-stone-400 text-[10px] font-mono'>
                        Quote
                      </span>
                    </button>
                  </div>

                  {/* CÀI ĐẶT TÔNG MÀU NỀN CỦA SLIDE */}
                  <div className='border border-stone-300 bg-white p-3.5 space-y-2'>
                    <span className='block text-[10px] font-bold uppercase tracking-wider text-stone-600'>
                      Tông màu nền slide
                    </span>
                    <div className='grid grid-cols-3 gap-2'>
                      {[
                        { id: 'default', name: 'Mặc định', bg: 'bg-white' },
                        { id: 'warm', name: 'Tông ấm', bg: 'bg-orange-50' },
                        {
                          id: 'mono',
                          name: 'Đen tối giản',
                          bg: 'bg-stone-900 text-white'
                        }
                      ].map((p) => (
                        <button
                          key={p.id}
                          type='button'
                          onClick={() => {
                            if (!slide) return
                            const nextSlides = lecture.slides.map((s, idx) =>
                              idx === active ? { ...s, pattern: p.id } : s
                            )
                            onLectureMutated({ ...lecture, slides: nextSlides })
                          }}
                          className={`p-2 border text-center text-xs font-semibold transition ${p.bg} ${
                            slidePattern === p.id
                              ? 'border-orange-700 ring-2 ring-orange-600 font-bold'
                              : 'border-stone-300 hover:border-stone-400'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
