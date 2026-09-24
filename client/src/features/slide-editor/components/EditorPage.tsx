import { ExportModal } from '@/components/ui/ExportModal'
import { useToast } from '@/components/ui/Toast'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { editorApi } from '@/features/slide-editor/api/editor.api'
import type { Lecture, ShapeType, Slide, SlideComponent } from '@/lib/types'
import { isAxiosError } from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useEditorStore } from '../store/editor.store'
import { AiCopilotPanel } from './AiCopilotPanel'
import { EditorHeader, type SaveStatus } from './EditorHeader'
import { FloatingContextualToolbar } from './FloatingContextualToolbar'
import { LeftSidebarRail } from './LeftSidebarRail'
import { SlideCanvas } from './SlideCanvas'
import { SlideFilmstrip } from './SlideFilmstrip'
import { getSlideComponents } from '../utils/slide'
import {
  saveOfflineDraft,
  getOfflineDraft,
  clearOfflineDraft
} from '../utils/offlineStorage'

interface EditorPageProps {
  initialLecture?: Lecture
  onBack?: () => void
  onPresent?: (lecture: Lecture) => void
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
  const { user } = useAuthStore()

  const {
    activeSlideIndex,
    setActiveSlideIndex,
    selectedCompId,
    setSelectedCompId,
    recordHistory,
    undo,
    redo,
    addAiMessage
  } = useEditorStore()

  const lectureFromState = (location.state as { lecture?: Lecture })?.lecture
  const lectureId = params.id || initialLecture?._id || lectureFromState?._id

  // Kiểm tra ngay khi khởi tạo xem có bản nháp offline trong localStorage không
  const [lecture, setLecture] = useState<Lecture | null>(() => {
    if (lectureId) {
      const draft = getOfflineDraft(lectureId)
      if (draft) {
        return draft.lecture
      }
    }
    return initialLecture || lectureFromState || null
  })
  const [isLoading, setIsLoading] = useState(!lecture)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isUnauthorized, setIsUnauthorized] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  // Trạng thái Bật/Tắt Tự động lưu (mặc định Bật, lưu vào localStorage)
  const [isAutoSave, setIsAutoSave] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('abslider_autosave_enabled')
      return saved !== 'false'
    } catch {
      return true
    }
  })

  // Trạng thái lưu: nếu mở từ bản nháp offline chưa đồng bộ, khởi tạo là 'offline_saved'
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(() => {
    if (lectureId && getOfflineDraft(lectureId)) {
      return 'offline_saved'
    }
    return 'saved'
  })
  const [countdown, setCountdown] = useState<number | null>(null)

  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  )
  const lectureRef = useRef(lecture)
  useEffect(() => {
    lectureRef.current = lecture
  }, [lecture])

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

  // Chuyển đổi trạng thái Bật / Tắt Autosave
  const handleToggleAutoSave = useCallback(() => {
    setIsAutoSave((prev) => {
      const next = !prev
      try {
        localStorage.setItem('abslider_autosave_enabled', String(next))
      } catch {
        // ignore
      }
      if (!next) {
        clearCountdownTimers()
      }
      return next
    })
  }, [clearCountdownTimers])

  // Thực hiện lưu bài giảng: kiểm tra online/offline
  const executeSave = useCallback(
    async (toSave: Lecture, isAuto = false) => {
      setSaveStatus('saving')
      clearCountdownTimers()

      // 1. Nếu không có kết nối mạng: lưu tạm vào localStorage
      if (!navigator.onLine) {
        saveOfflineDraft(toSave)
        setSaveStatus('offline_saved')
        if (!isAuto) {
          showToast(
            'Mất kết nối mạng. Đã lưu tạm bài giảng offline vào trình duyệt.',
            'info'
          )
        }
        return
      }

      // 2. Nếu có mạng: gửi lên server
      try {
        await editorApi.autosave(toSave)
        clearOfflineDraft(toSave._id)
        setSaveStatus('saved')
        if (!isAuto) {
          showToast('Đã lưu bài giảng lên máy chủ thành công', 'success')
        }
      } catch (err: unknown) {
        console.warn('Lỗi lưu server, chuyển sang lưu offline:', err)
        saveOfflineDraft(toSave)
        setSaveStatus('offline_saved')
        showToast(
          'Không thể kết nối máy chủ. Thay đổi đã được lưu tạm offline vào trình duyệt.',
          'error'
        )
      }
    },
    [clearCountdownTimers, showToast]
  )

  // Tải dữ liệu bài giảng từ server
  const loadLecture = useCallback(async () => {
    if (!params.id) return
    if (!lectureRef.current) {
      setIsLoading(true)
    }
    setLoadError(null)
    setIsUnauthorized(false)

    try {
      const loaded = await editorApi.get(params.id)

      // Kiểm tra quyền truy cập theo Use-case
      if (
        user &&
        loaded.userId &&
        loaded.userId !== user.id &&
        user.role !== 'admin'
      ) {
        setIsUnauthorized(true)
        setIsLoading(false)
        return
      }

      // Kiểm tra xem có bản nháp offline chưa đồng bộ không
      const draft = getOfflineDraft(params.id)
      const hasUnsyncedChanges =
        draft &&
        (JSON.stringify(draft.lecture.slides) !==
          JSON.stringify(loaded.slides) ||
          draft.lecture.title !== loaded.title)

      if (draft && hasUnsyncedChanges) {
        setLecture(draft.lecture)
        setSaveStatus('offline_saved')
        showToast(
          'Đã khôi phục bản nháp chỉnh sửa offline. Nhấn Ctrl+S hoặc nút Lưu để cập nhật lên máy chủ.',
          'info'
        )
      } else {
        setLecture(loaded)
        setSaveStatus('saved')
        if (draft) clearOfflineDraft(params.id)
      }

      // Khôi phục vị trí slide gần nhất từ sessionStorage theo Use-case
      const savedIndexStr = sessionStorage.getItem(
        `open4um_last_slide_${loaded._id}`
      )
      if (savedIndexStr !== null) {
        const savedIndex = Number(savedIndexStr)
        if (
          !isNaN(savedIndex) &&
          savedIndex >= 0 &&
          savedIndex < loaded.slides.length
        ) {
          setActiveSlideIndex(savedIndex)
        }
      }
    } catch (err) {
      // Khi server tắt hoặc offline: thử mở bản nháp offline từ localStorage
      const draft = getOfflineDraft(params.id)
      if (draft) {
        setLecture(draft.lecture)
        setSaveStatus('offline_saved')
        showToast(
          'Đang offline (máy chủ không phản hồi). Đã mở bản nháp lưu tạm trong trình duyệt.',
          'info'
        )
      } else if (!lectureRef.current) {
        const msg = isAxiosError(err)
          ? (err.response?.data as { message?: string })?.message ||
            'Không thể tải bài giảng'
          : 'Không thể kết nối đến máy chủ'
        setLoadError(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [params.id, user, setActiveSlideIndex, showToast])

  useEffect(() => {
    if (params.id) {
      void loadLecture()
    }
  }, [params.id, loadLecture])

  // Đồng bộ vị trí slide đang xem vào sessionStorage
  useEffect(() => {
    if (lecture?._id && activeSlideIndex >= 0) {
      sessionStorage.setItem(
        `open4um_last_slide_${lecture._id}`,
        String(activeSlideIndex)
      )
    }
  }, [lecture?._id, activeSlideIndex])

  // Cảnh báo người dùng khi có thay đổi chưa được lưu trước khi đóng tab
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'unsaved') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saveStatus])

  // Cập nhật trạng thái bài giảng và kích hoạt đếm ngược Autosave nếu đang bật
  const mutateLecture = useCallback(
    (next: Lecture, shouldRecordHistory = true) => {
      if (shouldRecordHistory && lectureRef.current) {
        recordHistory(lectureRef.current.slides)
      }

      setLecture(next)
      setSaveStatus('unsaved')
      clearCountdownTimers()

      // Nếu Autosave đang bật: đếm ngược debounce 2 giây rồi tự động lưu
      if (isAutoSave) {
        setCountdown(2)

        countdownIntervalRef.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev === null || prev <= 1) return 1
            return prev - 1
          })
        }, 1000)

        countdownTimerRef.current = setTimeout(() => {
          clearCountdownTimers()
          if (lectureRef.current) {
            void executeSave(lectureRef.current, true)
          }
        }, 2000)
      }
    },
    [clearCountdownTimers, executeSave, isAutoSave, recordHistory]
  )

  // Lưu thủ công (Ctrl+S / Cmd+S hoặc bấm nút Lưu)
  const handleManualSave = useCallback(() => {
    if (!lectureRef.current) return
    clearCountdownTimers()
    void executeSave(lectureRef.current, false)
  }, [clearCountdownTimers, executeSave])

  // Xử lý Undo
  const handleUndo = useCallback(() => {
    if (!lectureRef.current) return
    const prevSlides = undo(lectureRef.current.slides)
    if (prevSlides) {
      const nextLecture = { ...lectureRef.current, slides: prevSlides }
      mutateLecture(nextLecture, false)
    }
  }, [mutateLecture, undo])

  // Xử lý Redo
  const handleRedo = useCallback(() => {
    if (!lectureRef.current) return
    const nextSlides = redo(lectureRef.current.slides)
    if (nextSlides) {
      const nextLecture = { ...lectureRef.current, slides: nextSlides }
      mutateLecture(nextLecture, false)
    }
  }, [mutateLecture, redo])

  // Lắng nghe sự kiện kết nối mạng khôi phục (Online) để tự động đồng bộ
  useEffect(() => {
    const handleOnline = () => {
      if (
        lectureRef.current &&
        (saveStatus === 'offline_saved' || saveStatus === 'unsaved')
      ) {
        showToast(
          'Đã có kết nối mạng. Đang tự động đồng bộ bài giảng lên máy chủ...',
          'info'
        )
        void executeSave(lectureRef.current, true)
      }
    }

    const handleOffline = () => {
      showToast(
        'Mất kết nối mạng. Các thay đổi tiếp theo sẽ được lưu tạm offline.',
        'info'
      )
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [executeSave, saveStatus, showToast])

  // Lắng nghe phím tắt toàn cục (Ctrl+Z, Ctrl+Y, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Phím tắt Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleManualSave()
        return
      }
      // Phím tắt Undo (Ctrl+Z)
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === 'z'
      ) {
        e.preventDefault()
        handleUndo()
        return
      }
      // Phím tắt Redo (Ctrl+Y hoặc Ctrl+Shift+Z)
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault()
        handleRedo()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleManualSave, handleUndo, handleRedo])

  // Dọn dẹp timer khi unmount
  useEffect(() => {
    return () => clearCountdownTimers()
  }, [clearCountdownTimers])

  // THAO TÁC TRÊN SLIDE VÀ COMPONENT
  const currentSlide = lecture?.slides[activeSlideIndex]
  const currentComponents = currentSlide ? getSlideComponents(currentSlide) : []
  const selectedComponent =
    currentComponents.find((c) => c.id === selectedCompId) || null

  // Cập nhật thuộc tính của một component
  const handleUpdateComponent = useCallback(
    (
      compId: string,
      patch: Partial<SlideComponent>,
      shouldRecordHistory = true
    ) => {
      const currentLecture = lectureRef.current
      if (!currentLecture || !currentLecture.slides[activeSlideIndex]) return

      const sourceSlide = currentLecture.slides[activeSlideIndex]
      const comps = getSlideComponents(sourceSlide)
      const updatedComps = comps.map((c) =>
        c.id === compId ? { ...c, ...patch } : c
      )

      // Đồng bộ ngược title và bullets để AI và Presentation luôn hoạt động tốt
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
        idx === activeSlideIndex ? updatedSlide : s
      )
      mutateLecture(
        { ...currentLecture, slides: nextSlides },
        shouldRecordHistory
      )
    },
    [activeSlideIndex, mutateLecture]
  )

  // Thêm khối văn bản mới
  const handleAddTextComponent = (
    type: 'title' | 'subtitle' | 'text' | 'bullets' | 'quote'
  ) => {
    if (!lecture || !currentSlide) return
    const comps = getSlideComponents(currentSlide)
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
              ? 'Nhập trích dẫn ý nghĩa tại đây...'
              : 'Nội dung văn bản mới...',
      x: 12,
      y: 20 + comps.length * 6,
      width: 76,
      fontSize: type === 'title' ? 36 : type === 'subtitle' ? 18 : 20,
      fontWeight: type === 'title' ? 'bold' : 'normal',
      fontStyle: type === 'quote' || type === 'subtitle' ? 'italic' : 'normal',
      textDecoration: 'none',
      textCase: 'normal',
      textAlign: type === 'quote' ? 'center' : 'left',
      fontFamily: type === 'title' || type === 'quote' ? 'display' : 'sans',
      color: '#173c39'
    }

    const updatedComps = [...comps, newComp]
    const updatedSlide: Slide = { ...currentSlide, components: updatedComps }
    const nextSlides = lecture.slides.map((s, idx) =>
      idx === activeSlideIndex ? updatedSlide : s
    )

    mutateLecture({ ...lecture, slides: nextSlides })
    setSelectedCompId(newId)
  }

  // Thêm khối hình ảnh mới từ ảnh tải lên
  const handleAddImageComponent = (imageUrl: string) => {
    if (!lecture || !currentSlide) return
    const comps = getSlideComponents(currentSlide)
    const newId = `img-comp-${Date.now()}`

    const newComp: SlideComponent = {
      id: newId,
      type: 'image',
      content: imageUrl,
      imageUrl,
      x: 25,
      y: 20,
      width: 50,
      height: 38,
      fontSize: 20,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left'
    }

    const updatedComps = [...comps, newComp]
    const updatedSlide: Slide = { ...currentSlide, components: updatedComps }
    const nextSlides = lecture.slides.map((s, idx) =>
      idx === activeSlideIndex ? updatedSlide : s
    )

    mutateLecture({ ...lecture, slides: nextSlides })
    setSelectedCompId(newId)
  }

  // Thêm khối hình khối mới (Shape)
  const handleAddShapeComponent = (shapeType: ShapeType) => {
    if (!lecture || !currentSlide) return
    const comps = getSlideComponents(currentSlide)
    const newId = `shape-${Date.now()}`

    const isLine = shapeType === 'line'
    const isSquareOrCircle = shapeType === 'square' || shapeType === 'circle'

    const newComp: SlideComponent = {
      id: newId,
      type: 'shape',
      shapeType,
      content: '',
      fillColor: isLine ? 'transparent' : '#c45b3f',
      borderColor: '#173c39',
      borderWidth: isLine ? 3 : 0,
      borderRadius: shapeType === 'rounded-rect' ? 16 : 0,
      x: 35,
      y: 30,
      width: isLine ? 40 : isSquareOrCircle ? 25 : 35,
      height: isLine ? 2 : isSquareOrCircle ? 25 : 20
    }

    const updatedComps = [...comps, newComp]
    const updatedSlide: Slide = { ...currentSlide, components: updatedComps }
    const nextSlides = lecture.slides.map((s, idx) =>
      idx === activeSlideIndex ? updatedSlide : s
    )

    mutateLecture({ ...lecture, slides: nextSlides })
    setSelectedCompId(newId)
  }

  // Nhân bản component
  const handleDuplicateComponent = (comp: SlideComponent) => {
    if (!lecture || !currentSlide) return
    const comps = getSlideComponents(currentSlide)
    const newComp: SlideComponent = {
      ...comp,
      id: `comp-${Date.now()}`,
      x: Math.min(comp.x + 4, 85),
      y: Math.min(comp.y + 4, 85)
    }

    const updatedComps = [...comps, newComp]
    const updatedSlide: Slide = { ...currentSlide, components: updatedComps }
    const nextSlides = lecture.slides.map((s, idx) =>
      idx === activeSlideIndex ? updatedSlide : s
    )

    mutateLecture({ ...lecture, slides: nextSlides })
    setSelectedCompId(newComp.id)
  }

  // Xóa component
  const handleDeleteComponent = (compId: string) => {
    if (!lecture || !currentSlide) return
    const comps = getSlideComponents(currentSlide)
    const updatedComps = comps.filter((c) => c.id !== compId)
    const updatedSlide: Slide = { ...currentSlide, components: updatedComps }
    const nextSlides = lecture.slides.map((s, idx) =>
      idx === activeSlideIndex ? updatedSlide : s
    )

    mutateLecture({ ...lecture, slides: nextSlides })
    if (selectedCompId === compId) setSelectedCompId(null)
  }

  // Áp dụng layout mẫu cho slide
  const handleApplyTemplate = (layout: Slide['layout']) => {
    if (!lecture || !currentSlide) return
    const updatedSlide: Slide = { ...currentSlide, layout }
    const nextSlides = lecture.slides.map((s, idx) =>
      idx === activeSlideIndex ? updatedSlide : s
    )
    mutateLecture({ ...lecture, slides: nextSlides })
    showToast(`Đã áp dụng mẫu bố cục ${layout}`, 'success')
  }

  const handleAddSlide = (atIndex?: number) => {
    if (!lecture) return
    const targetIndex = atIndex ?? lecture.slides.length
    const newSlide: Slide = {
      id: `slide-${crypto.randomUUID()}`,
      title: 'Tiêu đề slide',
      bullets: []
    }

    const nextSlides = [...lecture.slides]
    nextSlides.splice(targetIndex, 0, newSlide)

    mutateLecture({ ...lecture, slides: nextSlides })
    setSelectedCompId(null)
    setActiveSlideIndex(targetIndex)
  }

  const handleDeleteSlide = (slideId: string) => {
    if (!lecture) return
    if (lecture.slides.length <= 1) {
      showToast('Bài giảng phải có ít nhất một slide', 'error')
      return
    }

    const targetIndex = lecture.slides.findIndex((s) => s.id === slideId)
    if (targetIndex === -1) return

    const nextSlides = lecture.slides.filter((s) => s.id !== slideId)
    mutateLecture({ ...lecture, slides: nextSlides })
    setSelectedCompId(null)

    if (targetIndex < activeSlideIndex) {
      setActiveSlideIndex(activeSlideIndex - 1)
    } else if (targetIndex === activeSlideIndex) {
      setActiveSlideIndex(Math.min(activeSlideIndex, nextSlides.length - 1))
    }
  }

  const handleDuplicateSlide = (slideId: string) => {
    if (!lecture) return
    const sourceIndex = lecture.slides.findIndex((s) => s.id === slideId)
    if (sourceIndex === -1) return

    const sourceSlide = lecture.slides[sourceIndex]
    const clonedSlide: Slide = {
      ...sourceSlide,
      id: `slide-${crypto.randomUUID()}`,
      components: getSlideComponents(sourceSlide).map((comp) => ({
        ...comp,
        id: `comp-${crypto.randomUUID()}`
      }))
    }

    const nextSlides = [...lecture.slides]
    nextSlides.splice(sourceIndex + 1, 0, clonedSlide)

    mutateLecture({ ...lecture, slides: nextSlides })
    setSelectedCompId(null)
    setActiveSlideIndex(sourceIndex + 1)
  }

  const handleMoveSlide = (slideId: string, toIndex: number) => {
    if (!lecture) return
    const sourceIndex = lecture.slides.findIndex((s) => s.id === slideId)
    if (sourceIndex === -1 || sourceIndex === toIndex) return

    const nextSlides = [...lecture.slides]
    const [moved] = nextSlides.splice(sourceIndex, 1)
    nextSlides.splice(toIndex, 0, moved)

    mutateLecture({ ...lecture, slides: nextSlides })

    if (sourceIndex === activeSlideIndex) {
      setActiveSlideIndex(toIndex)
    } else if (sourceIndex < activeSlideIndex && toIndex >= activeSlideIndex) {
      setActiveSlideIndex(activeSlideIndex - 1)
    } else if (sourceIndex > activeSlideIndex && toIndex <= activeSlideIndex) {
      setActiveSlideIndex(activeSlideIndex + 1)
    }
  }

  // Gọi AI chỉnh sửa slide từ ô prompt
  const handleApplyAiPrompt = async (instruction: string) => {
    if (!lecture || !currentSlide || !instruction.trim()) return
    try {
      setIsAiLoading(true)
      addAiMessage('user', instruction)

      const updated = await editorApi.aiEdit(
        lecture._id,
        currentSlide,
        instruction
      )
      recordHistory(lecture.slides)
      setLecture(updated)
      setSelectedCompId(null)
      setSaveStatus('saved')

      addAiMessage(
        'assistant',
        `Đã hoàn tất chỉnh sửa slide theo yêu cầu: "${instruction}"`
      )
      showToast('Đã áp dụng chỉnh sửa AI thành công', 'success')
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message ||
          'Không thể thực hiện chỉnh sửa AI'
        : 'Không thể thực hiện chỉnh sửa AI'
      addAiMessage('assistant', `⚠️ Không thể áp dụng chỉnh sửa: ${msg}`)
      showToast(msg, 'error')
    } finally {
      setIsAiLoading(false)
    }
  }

  // AI Quick Actions (Viết lại / Rút gọn / Mở rộng) từ mini-action pill
  const handleAiQuickAction = (action: 'rewrite' | 'shorten' | 'expand') => {
    const promptMap = {
      rewrite:
        'Hãy viết lại các ý trong slide này cho mạch lạc, thu hút và sắc nét hơn',
      shorten:
        'Rút gọn nội dung slide này thành 3 ý chính súc tích, ngắn gọn, dễ nhớ',
      expand:
        'Mở rộng và bổ sung thêm các luận điểm thực tế, minh họa chi tiết cho slide này'
    }
    void handleApplyAiPrompt(promptMap[action])
  }

  const handleBack = () => {
    if (saveStatus === 'unsaved' && lectureRef.current) {
      clearCountdownTimers()
      void executeSave(lectureRef.current, false)
    }
    if (onBack) onBack()
    else navigate('/library')
  }

  const handlePresent = () => {
    if (!lecture) return
    if (onPresent) onPresent(lecture)
    else navigate(`/presentation/${lecture._id}`, { state: { lecture } })
  }

  // MÀN HÌNH ĐANG TẢI
  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-brand-paper font-sans text-xs font-bold text-brand-ink'>
        <div className='flex flex-col items-center gap-2'>
          <span className='animate-spin text-2xl text-brand-rust'>⟳</span>
          <span>Đang tải bài giảng...</span>
        </div>
      </div>
    )
  }

  // MÀN HÌNH BÁO LỖI KHÔNG CÓ QUYỀN TRUY CẬP (THEO USE-CASE)
  if (isUnauthorized) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center bg-brand-paper p-6 font-sans text-center'>
        <span className='text-4xl'>🔒</span>
        <h2 className='mt-3 text-base font-bold text-red-600'>
          Không có quyền truy cập
        </h2>
        <p className='mt-1 max-w-sm text-xs text-stone-600'>
          Bạn không có quyền chỉnh sửa bài giảng này. Vui lòng quay về Thư viện
          của bạn.
        </p>
        <button
          type='button'
          onClick={() => navigate('/library')}
          className='mt-5 rounded-lg bg-brand-ink px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition hover:bg-[#112d2b]'
        >
          ← Quay về Thư viện
        </button>
      </div>
    )
  }

  // MÀN HÌNH BÁO LỖI TẢI DỮ LIỆU CÓ NÚT THỬ LẠI (THEO USE-CASE)
  if (loadError || !lecture) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center bg-brand-paper p-6 font-sans text-center'>
        <span className='text-4xl'>⚠️</span>
        <h2 className='mt-3 text-base font-bold text-red-600'>
          Không thể tải bài giảng
        </h2>
        <p className='mt-1 max-w-sm text-xs text-stone-600'>
          {loadError || 'Bài giảng không tồn tại hoặc đã bị xóa.'}
        </p>
        <div className='mt-5 flex items-center gap-3'>
          <button
            type='button'
            onClick={() => void loadLecture()}
            className='rounded-lg bg-brand-rust px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition hover:bg-[#b04f35]'
          >
            Thử lại
          </button>
          <button
            type='button'
            onClick={() => navigate('/library')}
            className='rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-stone-700 shadow-2xs transition hover:bg-stone-50'
          >
            ← Quay về Thư viện
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='flex h-screen flex-col overflow-hidden bg-brand-paper'>
      {/* 1. HEADER CANVA */}
      <EditorHeader
        title={lecture.title}
        onTitleChange={(newTitle) => {
          const next = { ...lecture, title: newTitle }
          mutateLecture(next, false)
        }}
        onBack={handleBack}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onManualSave={handleManualSave}
        onOpenExport={() => setIsExportModalOpen(true)}
        onPresent={handlePresent}
        saveStatus={saveStatus}
        countdown={countdown}
        isAutoSave={isAutoSave}
        onToggleAutoSave={handleToggleAutoSave}
      />

      {/* 2. KHÔNG GIAN LÀM VIỆC CHÍNH (CANVA 3 KHU VỰC) */}
      <div className='flex flex-1 overflow-hidden'>
        {/* CỘT TRÁI: Icon Rail hẹp + Drawer chọn Văn bản / Upload ảnh / Mẫu slide */}
        <LeftSidebarRail
          onAddTextComponent={handleAddTextComponent}
          onAddImageComponent={handleAddImageComponent}
          onAddShapeComponent={handleAddShapeComponent}
          onApplyTemplate={handleApplyTemplate}
          outline={lecture.outline}
        />

        {/* KHU VỰC TRUNG TÂM: Floating Contextual Toolbar + Slide Canvas + Bottom Filmstrip */}
        <main className='relative flex min-w-0 flex-1 flex-col overflow-hidden bg-brand-paper'>
          {/* Thanh công cụ định dạng ngữ cảnh nổi (Canva Floating Pill Toolbar) - Chỉ hiện khi focus vào element */}
          {selectedComponent && (
            <div className='absolute top-3 left-0 right-0 z-40 flex justify-center pointer-events-none transition-all'>
              <div className='pointer-events-auto'>
                <FloatingContextualToolbar
                  selectedComponent={selectedComponent}
                  onUpdateComponent={(patch) => {
                    if (selectedCompId)
                      handleUpdateComponent(selectedCompId, patch)
                  }}
                  onDuplicateComponent={handleDuplicateComponent}
                  onDeleteComponent={handleDeleteComponent}
                />
              </div>
            </div>
          )}

          {/* Khung Canvas tỷ lệ 16:9 */}
          <SlideCanvas
            slide={currentSlide}
            components={currentComponents}
            slideIndex={activeSlideIndex}
            totalSlides={lecture.slides.length}
            selectedCompId={selectedCompId}
            onSelectComponent={setSelectedCompId}
            onUpdateComponent={handleUpdateComponent}
            onDuplicateComponent={handleDuplicateComponent}
            onDeleteComponent={handleDeleteComponent}
            onAiQuickAction={handleAiQuickAction}
            isAiLoading={isAiLoading}
          />

          {/* Dải Slide ngang ở đáy màn hình (Bottom Filmstrip) */}
          <SlideFilmstrip
            slides={lecture.slides}
            activeSlideIndex={activeSlideIndex}
            onSelectSlide={setActiveSlideIndex}
            onAddSlide={handleAddSlide}
            onDuplicateSlide={handleDuplicateSlide}
            onDeleteSlide={handleDeleteSlide}
            onMoveSlide={handleMoveSlide}
          />
        </main>

        {/* CỘT PHẢI: Trợ lý AI Copilot */}
        <AiCopilotPanel
          onApplyAiPrompt={handleApplyAiPrompt}
          isAiLoading={isAiLoading}
        />
      </div>

      {/* MODAL XUẤT BÀI GIẢNG */}
      <ExportModal
        open={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        lecture={lecture}
        initialSlideIndex={activeSlideIndex}
        onSuccess={(msg) => showToast(msg, 'success')}
        onError={(msg) => showToast(msg, 'error')}
      />
    </div>
  )
}
