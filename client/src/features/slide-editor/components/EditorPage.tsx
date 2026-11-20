import { useShallow } from 'zustand/react/shallow'
import { ExportModal } from '@/features/export/components/ExportModal'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { editorApi } from '@/features/slide-editor/api/editor.api'
import type {
  ContentLayoutType,
  Lecture,
  ShapeType,
  Slide,
  SlideComponent
} from '@/lib/types'
import { isAxiosError } from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useBlocker,
  useLocation,
  useNavigate,
  useParams
} from 'react-router-dom'
import { getThemeById, withSlideColors } from '../constants/theme-options'
import {
  AiChatMessage,
  createWelcomeMessages,
  useEditorStore,
  type AiSlideProposalItem
} from '../store/editor.store'
import {
  clearLocalChatHistory,
  clearOfflineDraft,
  getOfflineDraft,
  saveOfflineDraft
} from '../utils/offlineStorage'
import { getSlideComponents, syncSlideWithTheme } from '../utils/slide'
import { AiCopilotPanel } from './AiCopilotPanel'
import { EditorHeader, type SaveStatus } from './EditorHeader'
import { FloatingContextualToolbar } from './FloatingContextualToolbar'
import { LeftSidebarRail } from './LeftSidebarRail'
import { SlideCanvas } from './SlideCanvas'
import { SlideFilmstrip } from './SlideFilmstrip'
import { SourceMaterialModal } from './SourceMaterialModal'
import { OutlineModal } from './OutlineModal'
import { AiGenerationWizard } from '@/features/lecture-generation/components/AiGenerationWizard'
import { generationApi } from '@/features/lecture-generation/api/generation.api'
import { createSerialAutosaver, hasSameSavedContent } from '../utils/autosave'
const resolveProposalTargetIndex = (
  slides: Slide[],
  proposedSlide: Slide,
  action?: string,
  targetSlideIndex?: number,
  targetSlideId?: string
) => {
  if (targetSlideId) {
    return slides.findIndex((slide) => slide.id === targetSlideId)
  }

  if (action !== 'CREATE_SLIDE') {
    const indexByProposedId = slides.findIndex(
      (slide) => slide.id === proposedSlide.id
    )
    if (indexByProposedId >= 0) return indexByProposedId
  }

  return typeof targetSlideIndex === 'number' &&
    targetSlideIndex >= 0 &&
    targetSlideIndex < slides.length
    ? targetSlideIndex
    : -1
}

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
  const aiRequestRef = useRef<AbortController | null>(null)
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const location = useLocation()
  const { updateUser } = useAuthStore()

  const {
    activeSlideIndex,
    setActiveSlideIndex,
    selectedCompId,
    setSelectedCompId,
    recordHistory,
    undo,
    redo,
    addAiMessage,
    setAiMessages,
    updateAiMessageStatus,
    aiMessages,
    previewSlide,
    previewSlideAction,
    previewTargetSlideId,
    setPreviewSlide,
    sourceMaterial,
    setSourceMaterial,
    isSourceMaterialModalOpen,
    setIsSourceMaterialModalOpen,
    clearHistory
  } = useEditorStore(
    useShallow((state) => ({
      activeSlideIndex: state.activeSlideIndex,
      setActiveSlideIndex: state.setActiveSlideIndex,
      selectedCompId: state.selectedCompId,
      setSelectedCompId: state.setSelectedCompId,
      recordHistory: state.recordHistory,
      undo: state.undo,
      redo: state.redo,
      addAiMessage: state.addAiMessage,
      setAiMessages: state.setAiMessages,
      updateAiMessageStatus: state.updateAiMessageStatus,
      aiMessages: state.aiMessages,
      previewSlide: state.previewSlide,
      previewSlideAction: state.previewSlideAction,
      previewTargetSlideId: state.previewTargetSlideId,
      setPreviewSlide: state.setPreviewSlide,
      sourceMaterial: state.sourceMaterial,
      setSourceMaterial: state.setSourceMaterial,
      isSourceMaterialModalOpen: state.isSourceMaterialModalOpen,
      setIsSourceMaterialModalOpen: state.setIsSourceMaterialModalOpen,
      clearHistory: state.clearHistory
    }))
  )

  const routeState = location.state as {
    lecture?: Lecture
    startAi?: boolean
  } | null
  const lectureFromState = routeState?.lecture
  // SRS UC021 bước 5: bài giảng vừa tạo mở kèm màn hình nhập Prompt AI
  const [showAiWizard, setShowAiWizard] = useState(Boolean(routeState?.startAi))
  const lectureId = params.id || initialLecture?._id || lectureFromState?._id
  useEffect(() => () => aiRequestRef.current?.abort(), [lectureId])

  // Bản nháp offline (nếu có) được hỏi Khôi phục/Bỏ qua sau khi tải xong (SRS UC009 5a/5b)
  const [lecture, setLecture] = useState<Lecture | null>(
    () => initialLecture || lectureFromState || null
  )
  const [pendingDraft, setPendingDraft] = useState<Lecture | null>(null)
  const [isLoading, setIsLoading] = useState(!lecture)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isUnauthorized, setIsUnauthorized] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isOutlineModalOpen, setIsOutlineModalOpen] = useState(false)
  const [isOutlineLoading, setIsOutlineLoading] = useState(false)

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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isLeaving, setIsLeaving] = useState(false)
  const leaveApprovedRef = useRef(false)
  const lastValidTitleRef = useRef(lecture?.title || 'Bài giảng chưa đặt tên')
  const loadRequestRef = useRef<AbortController | null>(null)
  const saveBlockedRef = useRef(false)
  const networkFailureNotifiedRef = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !leaveApprovedRef.current &&
      saveStatus !== 'saved' &&
      currentLocation.pathname !== nextLocation.pathname
  )

  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  )
  const lectureRef = useRef(lecture)
  const [autosaver] = useState(() => createSerialAutosaver(editorApi.autosave))
  const pendingSavesRef = useRef(0)
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
      if (saveBlockedRef.current) return false
      setSaveStatus('saving')
      clearCountdownTimers()

      const payload = toSave.title.trim()
        ? toSave
        : { ...toSave, title: lastValidTitleRef.current }

      // 1. Nếu không có kết nối mạng: lưu tạm vào localStorage
      if (!navigator.onLine) {
        if (!saveOfflineDraft(payload)) {
          setSaveStatus('error')
          setSaveError(
            'Trình duyệt không còn đủ dung lượng lưu bản nháp. Vui lòng giữ trang này và kết nối lại để lưu lên máy chủ.'
          )
          return false
        }
        setSaveStatus('offline_saved')
        if (!isAuto) {
          showToast(
            'Mất kết nối mạng. Đã lưu tạm bài giảng offline vào trình duyệt.',
            'info'
          )
        }
        return false
      }

      // 2. Nếu có mạng: gửi lên server
      pendingSavesRef.current += 1
      try {
        const receipt = await autosaver.save(payload)
        networkFailureNotifiedRef.current = false
        lastValidTitleRef.current = payload.title
        setSaveError(null)
        if (lectureRef.current?._id === payload._id) {
          const current = lectureRef.current
          const unchanged = hasSameSavedContent(current, toSave)
          const next = {
            ...(unchanged ? payload : current),
            revision: receipt.revision,
            updatedAt: receipt.savedAt
          }
          lectureRef.current = next
          setLecture(next)
          if (unchanged) {
            if (payload !== toSave) {
              showToast(
                'Tên bài giảng không được để trống. Đã giữ lại tên hợp lệ trước đó.',
                'info'
              )
            }
            clearOfflineDraft(payload._id)
            setSaveStatus(pendingSavesRef.current > 1 ? 'saving' : 'saved')
          } else {
            setSaveStatus(pendingSavesRef.current > 1 ? 'saving' : 'unsaved')
          }
        }
        if (!isAuto) {
          showToast('Đã lưu bài giảng lên máy chủ thành công', 'success')
        }
        return true
      } catch (err: unknown) {
        console.warn('Lỗi lưu server, chuyển sang lưu offline:', err)
        const latestLecture =
          lectureRef.current?._id === payload._id ? lectureRef.current : payload
        const draftSaved = saveOfflineDraft(latestLecture)
        const status = isAxiosError(err) ? err.response?.status : undefined
        if (status) {
          if ([403, 404, 409].includes(status)) saveBlockedRef.current = true
          const serverMessage =
            (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || 'Không thể lưu bài giảng.'
          const message = draftSaved
            ? serverMessage
            : `${serverMessage} Trình duyệt cũng không lưu được bản nháp. Vui lòng giữ trang này để tránh mất chỉnh sửa.`
          setSaveError(message)
          setSaveStatus('error')
          showToast(message, 'error')
        } else {
          const message = draftSaved
            ? 'Không thể kết nối máy chủ. Thay đổi đã được lưu tạm offline vào trình duyệt.'
            : 'Không thể kết nối máy chủ và không lưu được bản nháp trong trình duyệt. Vui lòng giữ trang này để tránh mất chỉnh sửa.'
          if (lectureRef.current?._id === payload._id) {
            setSaveError(message)
            setSaveStatus(
              draftSaved
                ? pendingSavesRef.current > 1
                  ? 'saving'
                  : 'offline_saved'
                : 'error'
            )
          }
          // Chỉ báo một lần mỗi đợt lỗi mạng; lưu thủ công vẫn luôn có phản hồi.
          if (!isAuto || !networkFailureNotifiedRef.current)
            showToast(message, 'error')
          networkFailureNotifiedRef.current = true
        }
        return false
      } finally {
        pendingSavesRef.current -= 1
      }
    },
    [autosaver, clearCountdownTimers, showToast]
  )

  const flushChanges = useCallback(
    async (keepDraftOnly = false) => {
      if (keepDraftOnly && lectureRef.current) {
        const kept = saveOfflineDraft(lectureRef.current)
        if (kept) leaveApprovedRef.current = true
        if (!kept)
          showToast(
            'Không thể giữ bản nháp trong trình duyệt. Vui lòng lưu lên máy chủ trước khi rời trang.',
            'error'
          )
        return kept
      }
      let pending = lectureRef.current
      while (pending) {
        if (!(await executeSave(pending, false))) return false
        const latest = lectureRef.current
        if (latest && hasSameSavedContent(latest, pending)) {
          leaveApprovedRef.current = true
          return true
        }
        pending = latest
      }
      leaveApprovedRef.current = true
      return true
    },
    [executeSave, showToast]
  )

  useEffect(() => {
    useEditorStore
      .getState()
      .setBeforeLeave(saveStatus === 'saved' ? null : flushChanges)
    return () => useEditorStore.getState().setBeforeLeave(null)
  }, [flushChanges, saveStatus])

  // Tải dữ liệu bài giảng từ server
  const loadLecture = useCallback(async () => {
    if (!params.id) return
    loadRequestRef.current?.abort()
    const controller = new AbortController()
    loadRequestRef.current = controller
    if (!lectureRef.current || lectureRef.current._id !== params.id) {
      setIsLoading(true)
    }
    setLoadError(null)
    setIsUnauthorized(false)
    clearHistory()

    try {
      const loaded = await editorApi.get(params.id, controller.signal)
      if (controller.signal.aborted) return
      autosaver.reset(loaded)
      saveBlockedRef.current = false
      lectureRef.current = loaded
      lastValidTitleRef.current = loaded.title
      setSourceMaterial(loaded.sourceMaterial || '')
      setSaveError(null)

      // Kiểm tra xem có bản nháp offline chưa đồng bộ không
      const draft = getOfflineDraft(params.id, useAuthStore.getState().user?.id)
      const hasUnsyncedChanges =
        draft &&
        (
          [
            'title',
            'slides',
            'theme',
            'sourceMaterial',
            'contextSummary'
          ] as const
        ).some(
          (field) =>
            JSON.stringify(draft.lecture[field]) !==
            JSON.stringify(loaded[field])
        )

      setLecture(loaded)
      setAiMessages(
        loaded.aiChatHistory?.length
          ? (loaded.aiChatHistory as unknown as AiChatMessage[])
          : createWelcomeMessages()
      )
      setSaveStatus('saved')
      if (draft && hasUnsyncedChanges) setPendingDraft(draft.lecture)
      else if (draft) clearOfflineDraft(params.id)

      // SRS UC009 bước 7: chọn slide mở gần nhất, nếu không có thì slide đầu tiên
      const savedIndex = Number(
        sessionStorage.getItem(`open4um_last_slide_${loaded._id}`)
      )
      setActiveSlideIndex(
        Number.isInteger(savedIndex) &&
          savedIndex >= 0 &&
          savedIndex < loaded.slides.length
          ? savedIndex
          : 0
      )
    } catch (err) {
      if (controller.signal.aborted) return
      // SRS UC009 2a: không có quyền truy cập
      if (isAxiosError(err) && err.response?.status === 403) {
        setIsUnauthorized(true)
        return
      }
      // Khi server tắt hoặc offline: thử mở bản nháp offline từ localStorage
      const draft = getOfflineDraft(params.id, useAuthStore.getState().user?.id)
      if (draft && (!isAxiosError(err) || !err.response)) {
        setLecture(draft.lecture)
        lectureRef.current = draft.lecture
        setSourceMaterial(draft.lecture.sourceMaterial || '')
        setAiMessages(createWelcomeMessages())
        setSaveStatus('offline_saved')
        showToast(
          'Đang offline (máy chủ không phản hồi). Đã mở bản nháp lưu tạm trong trình duyệt.',
          'info'
        )
      } else {
        const msg = isAxiosError(err)
          ? (err.response?.data as { message?: string })?.message ||
            'Không thể tải bài giảng'
          : 'Không thể kết nối đến máy chủ'
        setLoadError(msg)
      }
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [
    params.id,
    autosaver,
    clearHistory,
    setActiveSlideIndex,
    setAiMessages,
    setSourceMaterial,
    showToast
  ])

  useEffect(() => {
    if (params.id) {
      void loadLecture()
    }
    return () => loadRequestRef.current?.abort()
  }, [params.id, loadLecture])

  useEffect(() => {
    clearLocalChatHistory()
    setAiMessages(createWelcomeMessages())
    setSourceMaterial('')
    setIsSourceMaterialModalOpen(false)
    setSelectedCompId(null)
    setPreviewSlide(null)
    leaveApprovedRef.current = false
    networkFailureNotifiedRef.current = false
    return () => {
      setSourceMaterial('')
      setIsSourceMaterialModalOpen(false)
    }
  }, [
    lectureId,
    setAiMessages,
    setSourceMaterial,
    setIsSourceMaterialModalOpen,
    setSelectedCompId,
    setPreviewSlide
  ])

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
      if (saveStatus !== 'saved') {
        if (lectureRef.current) saveOfflineDraft(lectureRef.current)
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
      leaveApprovedRef.current = false
      if (shouldRecordHistory && lectureRef.current) {
        recordHistory(lectureRef.current.slides)
      }

      lectureRef.current = next
      setLecture(next)
      setSaveStatus(saveBlockedRef.current ? 'error' : 'unsaved')
      clearCountdownTimers()

      // Nếu Autosave đang bật: đếm ngược debounce 2 giây rồi tự động lưu
      if (isAutoSave && !saveBlockedRef.current) {
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
      // Bỏ qua nếu bộ gõ tiếng Việt / IME đang trong giai đoạn kết hợp ký tự
      if (
        e.isComposing ||
        (e as unknown as { keyCode: number }).keyCode === 229
      ) {
        return
      }

      // Phím tắt Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleManualSave()
        return
      }

      // Nếu đang focus vào input/textarea bên ngoài Canvas (như ô chat AI hoặc ô tiêu đề),
      // hãy để trình duyệt tự xử lý undo/redo của input đó
      const target = e.target as HTMLElement | null
      if (document.querySelector('[role="dialog"]')) return
      const isExternalInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
        !target.getAttribute('data-slide-canvas-text')

      if (isExternalInput) {
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
  const isPreviewVisible = Boolean(
    previewSlide &&
    (previewSlideAction === 'CREATE_SLIDE' ||
      !previewTargetSlideId ||
      currentSlide?.id === previewTargetSlideId)
  )
  const activeSlideToDisplay = isPreviewVisible ? previewSlide : currentSlide
  const currentComponents = activeSlideToDisplay
    ? getSlideComponents(activeSlideToDisplay, lecture?.theme)
    : []
  const selectedComponent =
    currentComponents.find((component) => component.id === selectedCompId) ||
    null

  const handleUpdateComponent = useCallback(
    (
      compId: string,
      patch: Partial<SlideComponent>,
      shouldRecordHistory = true
    ) => {
      const currentLecture = lectureRef.current
      if (!currentLecture || !currentLecture.slides[activeSlideIndex])
        return false

      const sourceSlide = currentLecture.slides[activeSlideIndex]
      const comps = getSlideComponents(sourceSlide, currentLecture.theme)
      const target = comps.find((component) => component.id === compId)
      if (
        !target ||
        Object.entries(patch).every(
          ([key, value]) => target[key as keyof SlideComponent] === value
        )
      )
        return false
      const updatedComps = comps.map((c) =>
        c.id === compId ? { ...c, ...patch } : c
      )

      // Đồng bộ ngược title và bullets để AI và Presentation luôn hoạt động tốt
      const titleComp = updatedComps.find((c) => c.type === 'title')
      const subComp = updatedComps.find((c) => c.type === 'subtitle')
      const bulletsComp = updatedComps.find((c) => c.type === 'bullets')

      const updatedSlide: Slide = {
        ...sourceSlide,
        title: titleComp ? titleComp.content : '',
        subtitle: subComp ? subComp.content : '',
        bullets: bulletsComp
          ? bulletsComp.content.split('\n').filter((s) => s.trim())
          : [],
        components: updatedComps
      }

      const nextSlides = currentLecture.slides.map((s, idx) =>
        idx === activeSlideIndex ? updatedSlide : s
      )
      mutateLecture(
        { ...currentLecture, slides: nextSlides },
        shouldRecordHistory
      )
      return true
    },
    [activeSlideIndex, mutateLecture]
  )

  useEffect(() => {
    const handleFormatShortcut = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.isComposing ||
        !selectedComponent
      )
        return
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          'input,select,textarea:not([data-slide-canvas-text]),[role="dialog"]'
        )
      )
        return
      if (
        selectedComponent.type === 'image' ||
        selectedComponent.type === 'shape'
      )
        return
      const key = event.key.toLowerCase()
      const patch: Partial<SlideComponent> | undefined =
        key === 'b'
          ? {
              fontWeight:
                selectedComponent.fontWeight === 'bold' ? 'normal' : 'bold'
            }
          : key === 'i'
            ? {
                fontStyle:
                  selectedComponent.fontStyle === 'italic' ? 'normal' : 'italic'
              }
            : key === 'u'
              ? {
                  textDecoration:
                    selectedComponent.textDecoration === 'underline'
                      ? 'none'
                      : 'underline'
                }
              : undefined
      if (!patch) return
      event.preventDefault()
      handleUpdateComponent(selectedComponent.id, patch)
    }
    window.addEventListener('keydown', handleFormatShortcut)
    return () => window.removeEventListener('keydown', handleFormatShortcut)
  }, [selectedComponent, handleUpdateComponent])

  const handleAddTextComponent = (
    type: 'title' | 'subtitle' | 'text' | 'bullets'
  ) => {
    const currentLecture = lectureRef.current
    if (!currentLecture) return
    const targetIndex = useEditorStore.getState().activeSlideIndex
    const targetSlide = currentLecture.slides[targetIndex]
    if (!targetSlide) {
      showToast(
        'Bài giảng chưa có slide. Hãy thêm slide trước khi chèn văn bản.',
        'info'
      )
      return
    }
    const comps = getSlideComponents(targetSlide, currentLecture.theme)
    const theme = withSlideColors(
      getThemeById(targetSlide.theme || currentLecture.theme),
      targetSlide
    )
    const newId = `comp-${crypto.randomUUID()}`

    const newComp: SlideComponent = {
      id: newId,
      type,
      content:
        type === 'title'
          ? 'Tiêu đề mới'
          : type === 'subtitle'
            ? 'Dòng phụ đề mới'
            : 'Nội dung văn bản mới...',
      x: 12,
      // Giữ khối mới trong vùng nhìn thấy, kể cả slide có nhiều đối tượng.
      y: 20 + (comps.length % 6) * 6,
      width: 76,
      fontSize: type === 'title' ? 36 : type === 'subtitle' ? 18 : 20,
      fontWeight: type === 'title' ? 'bold' : 'normal',
      fontStyle: type === 'subtitle' ? 'italic' : 'normal',
      textDecoration: 'none',
      textCase: 'normal',
      textAlign: 'left',
      fontFamily: type === 'title' ? 'display' : 'sans',
      color: theme.textPrimary
    }

    const updatedComps = [...comps, newComp]
    const updatedSlide: Slide = { ...targetSlide, components: updatedComps }
    const nextSlides = currentLecture.slides.map((s, idx) =>
      idx === targetIndex ? updatedSlide : s
    )

    mutateLecture({ ...currentLecture, slides: nextSlides })
    setPreviewSlide(null)
    setSelectedCompId(newId)
  }

  // Thêm khối hình ảnh mới từ ảnh tải lên
  const handleAddImageComponent = (imageUrl: string) => {
    if (!lecture || !currentSlide) return
    const comps = getSlideComponents(currentSlide, lecture.theme)
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
    const comps = getSlideComponents(currentSlide, lecture.theme)
    const newId = `shape-${Date.now()}`

    const isLine = shapeType === 'line'
    const isSquareOrCircle = shapeType === 'square' || shapeType === 'circle'
    const currentTheme = getThemeById(lecture.theme)

    const newComp: SlideComponent = {
      id: newId,
      type: 'shape',
      shapeType,
      content: '',
      fillColor: isLine ? 'transparent' : currentTheme.cardBackground,
      borderColor: currentTheme.cardBorder,
      borderWidth: isLine ? 3 : 1,
      borderRadius: shapeType === 'rounded-rect' ? 16 : 0,
      x: 35,
      y: 30,
      width: isLine ? 40 : isSquareOrCircle ? 25 : 35,
      height: isLine ? 2 : isSquareOrCircle ? (25 * 16) / 9 : 20
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
    const comps = getSlideComponents(currentSlide, lecture.theme)
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
  const handleDeleteComponent = (
    compId: string,
    shouldRecordHistory = true
  ) => {
    const currentLecture = lectureRef.current
    const active = currentLecture?.slides[activeSlideIndex]
    if (!currentLecture || !active) return
    const comps = getSlideComponents(active, currentLecture.theme)
    const updatedComps = comps.filter((c) => c.id !== compId)

    // Đồng bộ lại title, subtitle, bullets tương ứng với các components còn lại
    const titleComp = updatedComps.find((c) => c.type === 'title')
    const subComp = updatedComps.find((c) => c.type === 'subtitle')
    const bulletsComp = updatedComps.find((c) => c.type === 'bullets')

    const updatedSlide: Slide = {
      ...active,
      title: titleComp ? titleComp.content : '',
      subtitle: subComp ? subComp.content : '',
      bullets: bulletsComp
        ? bulletsComp.content.split('\n').filter((s) => s.trim())
        : [],
      components: updatedComps
    }
    const nextSlides = currentLecture.slides.map((s, idx) =>
      idx === activeSlideIndex ? updatedSlide : s
    )

    mutateLecture(
      { ...currentLecture, slides: nextSlides },
      shouldRecordHistory
    )
    if (selectedCompId === compId) setSelectedCompId(null)
  }

  // SRS UC012: đổi thứ tự lớp; phần tử đứng sau trong mảng được vẽ đè lên trên
  const handleChangeLayer = (compId: string, direction: 'up' | 'down') => {
    if (!lecture || !currentSlide) return
    const comps = [...getSlideComponents(currentSlide, lecture.theme)]
    const from = comps.findIndex((c) => c.id === compId)
    const to = direction === 'up' ? from + 1 : from - 1
    if (from < 0 || to < 0 || to >= comps.length) return
    ;[comps[from], comps[to]] = [comps[to], comps[from]]
    mutateLecture({
      ...lecture,
      slides: lecture.slides.map((s, idx) =>
        idx === activeSlideIndex ? { ...currentSlide, components: comps } : s
      )
    })
  }

  // SRS UC012 7b-7d / UC015: Delete xóa đối tượng đang chọn, không chọn đối tượng thì xóa slide; đang gõ chữ thì để trình duyệt xóa chữ
  useEffect(() => {
    const handleDeleteKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' || e.isComposing) return
      const target = e.target as HTMLElement | null
      const isTyping =
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'
      if (isTyping || showAiWizard || document.querySelector('[role="dialog"]'))
        return
      e.preventDefault()
      if (selectedCompId) handleDeleteComponent(selectedCompId)
      else if (currentSlide) handleDeleteSlide(currentSlide.id)
    }
    window.addEventListener('keydown', handleDeleteKey)
    return () => window.removeEventListener('keydown', handleDeleteKey)
  })

  // Đổi giao diện bài giảng (Theme) và đồng bộ màu sắc các slide hiện có
  const handleThemeChange = (themeId: string) => {
    if (!lecture) return
    const themePreset = getThemeById(themeId)
    const updatedLecture: Lecture = {
      ...lecture,
      theme: themeId,
      slides: lecture.slides.map((s) => syncSlideWithTheme(s, themeId))
    }
    mutateLecture(updatedLecture)
    showToast(`Đã đổi giao diện thành "${themePreset.name}"`, 'success')
  }

  // Áp dụng bố cục nội dung trực quan hiện đại cho slide hiện tại
  const handleApplyContentLayout = (layout: ContentLayoutType) => {
    if (!lecture || !currentSlide) return

    let items = currentSlide.contentItems
    if (!items || items.length === 0) {
      if (currentSlide.bullets && currentSlide.bullets.length > 0) {
        items = currentSlide.bullets.map((b, i) => {
          const parts = b.split(':')
          if (parts.length > 1) {
            return {
              title: parts[0].trim(),
              description: parts.slice(1).join(':').trim(),
              tag: `Mục 0${i + 1}`
            }
          }
          return {
            title: `Ý chính 0${i + 1}`,
            description: b.trim(),
            tag: `Phần 0${i + 1}`
          }
        })
      } else {
        items = [
          {
            title: 'Trọng tâm 1',
            description:
              'Phân tích bản chất vấn đề và xây dựng giải pháp cốt lõi.',
            tag: 'Giai đoạn 1',
            stat: '85%'
          },
          {
            title: 'Trọng tâm 2',
            description:
              'Triển khai thực thi có đo lường và đánh giá liên tục.',
            tag: 'Giai đoạn 2',
            stat: '3.2x'
          },
          {
            title: 'Trọng tâm 3',
            description:
              'Đúc kết giá trị thực tiễn và mở rộng quy mô hành động.',
            tag: 'Giai đoạn 3',
            stat: 'Top 1'
          }
        ]
      }
    }

    const rawSlide: Slide = {
      ...currentSlide,
      layout,
      contentLayout: layout,
      contentItems: items,
      components: undefined
    }

    const updatedSlide: Slide = {
      ...rawSlide,
      components: getSlideComponents(rawSlide, lecture.theme)
    }

    const nextSlides = lecture.slides.map((s, idx) =>
      idx === activeSlideIndex ? updatedSlide : s
    )
    mutateLecture({ ...lecture, slides: nextSlides })
    setSelectedCompId(null)
    showToast(`Đã áp dụng bố cục: ${layout}`, 'success')
  }

  const handleAddSlide = (atIndex?: number) => {
    if (!lecture) return
    const targetIndex = atIndex ?? lecture.slides.length
    const rawSlide: Slide = {
      id: `slide-${crypto.randomUUID()}`,
      title: 'Tiêu đề slide',
      bullets: []
    }
    let newSlide: Slide
    try {
      newSlide = {
        ...rawSlide,
        components: getSlideComponents(rawSlide, lecture.theme)
      }
    } catch {
      // SRS UC014 4a: không khởi tạo được slide -> giữ nguyên bài giảng
      showToast('Không thể tạo slide mới. Vui lòng thử lại.', 'error')
      return
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

    let clonedSlide: Slide
    try {
      // Bản sao độc lập hoàn toàn (SRS UC016): không dùng chung mảng với slide gốc
      const sourceSlide = structuredClone(lecture.slides[sourceIndex])
      clonedSlide = {
        ...sourceSlide,
        id: `slide-${crypto.randomUUID()}`,
        components: getSlideComponents(sourceSlide, lecture.theme).map(
          (comp) => ({ ...comp, id: `comp-${crypto.randomUUID()}` })
        )
      }
    } catch {
      // SRS UC016 3a: không sao chép được -> không tạo slide mới
      showToast('Không thể nhân bản slide. Vui lòng thử lại.', 'error')
      return
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
    // SRS UC017 bước 8: slide vừa di chuyển giữ trạng thái được chọn
    setSelectedCompId(null)
    setActiveSlideIndex(toIndex)
  }

  // Gọi AI chat / chỉnh sửa slide với context đầy đủ
  const handleApplyAiPrompt = async (instruction: string) => {
    if (!lecture || !currentSlide || !instruction.trim() || isAiLoading)
      return false
    if (lectureRef.current?._id !== lecture._id) return false
    const controller = new AbortController()
    aiRequestRef.current = controller
    const requestTargetSlideId = currentSlide.id
    const requestTargetSlideIndex = activeSlideIndex
    try {
      setIsAiLoading(true)
      addAiMessage('user', instruction)

      const historyPayload = aiMessages
        .filter((m) => m.id !== 'welcome-msg')
        .slice(-6)
        .map((m) => ({
          role: m.role,
          text: m.text
        }))

      const currentSlideSnapshot: Slide = {
        ...currentSlide,
        components: getSlideComponents(currentSlide, lecture.theme)
      }

      const response = await editorApi.aiChat(
        lecture._id,
        {
          message: instruction,
          slideId: currentSlide.id,
          currentSlide: currentSlideSnapshot,
          selectedCompId: selectedCompId || undefined,
          sourceMaterial: sourceMaterial,
          history: historyPayload
        },
        controller.signal
      )
      if (controller.signal.aborted || lectureRef.current?._id !== lecture._id)
        return false

      updateUser({ creditBalance: response.creditBalance })

      const targetIndex =
        typeof response.targetSlideIndex === 'number' &&
        response.targetSlideIndex >= 0 &&
        response.targetSlideIndex < lecture.slides.length
          ? response.targetSlideIndex
          : requestTargetSlideIndex

      const formattedProposals = response.proposals?.map((p, idx) => ({
        id: p.id || `prop-${Date.now()}-${idx}`,
        action: p.action,
        targetSlideIndex: p.targetSlideIndex,
        targetSlideId:
          p.targetSlideId || lecture.slides[p.targetSlideIndex]?.id,
        proposedSlide: p.proposedSlide,
        summary: p.summary,
        status: 'pending' as const
      }))

      const activeProp =
        formattedProposals && formattedProposals.length > 0
          ? formattedProposals[0]
          : undefined
      const slideToPreview = activeProp?.proposedSlide || response.proposedSlide
      const slideAction =
        activeProp?.action ||
        (response.action === 'CREATE_SLIDE' ? 'CREATE_SLIDE' : 'UPDATE_SLIDE')
      const pTargetIdx =
        activeProp?.targetSlideIndex !== undefined
          ? activeProp.targetSlideIndex
          : targetIndex
      const pTargetSlideId =
        activeProp?.targetSlideId ||
        response.targetSlideId ||
        lecture.slides[pTargetIdx]?.id ||
        (pTargetIdx === requestTargetSlideIndex
          ? requestTargetSlideId
          : undefined)

      if (
        response.aiChatHistory &&
        Array.isArray(response.aiChatHistory) &&
        response.aiChatHistory.length > 0
      ) {
        const serverHistory =
          response.aiChatHistory as unknown as Array<AiChatMessage>
        const enrichedHistory = serverHistory.map((message, index) =>
          index === serverHistory.length - 1 && message.role === 'assistant'
            ? {
                ...message,
                targetSlideIndex: pTargetIdx,
                targetSlideId: pTargetSlideId,
                proposedSlide: response.proposedSlide,
                proposals: formattedProposals
              }
            : message
        )
        setAiMessages(enrichedHistory)
        setLecture((prev) =>
          prev
            ? {
                ...prev,
                aiChatHistory: enrichedHistory as unknown as Array<
                  Record<string, unknown>
                >
              }
            : prev
        )
      } else {
        addAiMessage({
          role: 'assistant',
          text: response.reply,
          action: response.action,
          targetSlideIndex: pTargetIdx,
          targetSlideId: pTargetSlideId,
          proposedSlide: response.proposedSlide,
          proposals: formattedProposals,
          status:
            response.proposedSlide ||
            (formattedProposals && formattedProposals.length > 0)
              ? 'pending'
              : undefined
        })
      }

      let canShowPreview = Boolean(slideToPreview)
      let latestTargetIndex = pTargetIdx
      if (slideToPreview) {
        const latestLecture = lectureRef.current
        latestTargetIndex = latestLecture
          ? resolveProposalTargetIndex(
              latestLecture.slides,
              slideToPreview,
              slideAction,
              pTargetIdx,
              pTargetSlideId
            )
          : -1
        canShowPreview = latestTargetIndex >= 0

        if (!canShowPreview) {
          setPreviewSlide(null)
          showToast(
            'Slide đích của đề xuất không còn tồn tại. Vui lòng gửi lại yêu cầu.',
            'error'
          )
        } else {
          const latestActiveSlideIndex =
            useEditorStore.getState().activeSlideIndex
          if (latestTargetIndex !== latestActiveSlideIndex) {
            setActiveSlideIndex(latestTargetIndex)
          }
        }
      }

      // SRS UC008 bước 5: chỉnh sửa slide đang active được áp dụng trực tiếp (Undo để hoàn tác)
      const shouldAutoApply =
        canShowPreview &&
        slideAction === 'UPDATE_SLIDE' &&
        (response.proposals?.length ?? 0) <= 1
      if (shouldAutoApply && slideToPreview && lectureRef.current) {
        const latest = lectureRef.current
        const appliedMessages = useEditorStore
          .getState()
          .aiMessages.map((m, idx, list) =>
            idx === list.length - 1 && m.role === 'assistant'
              ? {
                  ...m,
                  status: 'accepted' as const,
                  proposals: m.proposals?.map((p) => ({
                    ...p,
                    status: 'accepted' as const
                  }))
                }
              : m
          )
        setAiMessages(appliedMessages)
        mutateLecture({
          ...latest,
          slides: latest.slides.map((s, idx) =>
            idx === latestTargetIndex
              ? {
                  ...slideToPreview,
                  components: getSlideComponents(slideToPreview, latest.theme)
                }
              : s
          ),
          aiChatHistory: appliedMessages as unknown as Array<
            Record<string, unknown>
          >
        })
        setPreviewSlide(null)
        setSelectedCompId(null)
        showToast(
          `Đã áp dụng chỉnh sửa AI vào Slide ${latestTargetIndex + 1}`,
          'success'
        )
      } else if (
        canShowPreview &&
        slideToPreview &&
        response.proposals &&
        response.proposals.length > 1
      ) {
        // Nhiều đề xuất (BATCH_CHANGES): preview slide đầu tiên
        setPreviewSlide(slideToPreview, slideAction, pTargetSlideId)
        showToast(
          `AI đã đề xuất ${response.proposals.length} slide mới. Bạn có thể xem trước hoặc chấp nhận tất cả.`,
          'info'
        )
      } else if (canShowPreview && slideToPreview) {
        setPreviewSlide(slideToPreview, slideAction, pTargetSlideId)
        showToast(
          slideAction === 'CREATE_SLIDE'
            ? 'AI đã đề xuất tạo slide mới. Bạn có thể xem trước trên Canvas.'
            : `AI đã đề xuất thay đổi cho Slide ${latestTargetIndex + 1}. Bạn có thể xem trước trên Canvas.`,
          'info'
        )
      } else if (!slideToPreview) {
        showToast('AI đã phản hồi yêu cầu của bạn', 'info')
      }

      if (
        response.updatedSummary &&
        response.updatedSummary !== lecture.contextSummary
      ) {
        setLecture((prev) =>
          prev ? { ...prev, contextSummary: response.updatedSummary } : prev
        )
      }
      return true
    } catch (err) {
      if (controller.signal.aborted) return false
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message ||
          'Không thể thực hiện yêu cầu AI'
        : 'Không thể thực hiện yêu cầu AI'
      addAiMessage('assistant', `⚠️ Không thể xử lý yêu cầu: ${msg}`)
      showToast(msg, 'error')
      return false
    } finally {
      setIsAiLoading(false)
    }
  }

  // Chấp nhận đề xuất từ AI (Accept)
  const handleAcceptProposal = (
    messageId: string,
    proposedSlide: Slide,
    action?: string,
    targetSlideIndex?: number,
    targetSlideId?: string
  ) => {
    if (!lecture) return
    const targetIdx = resolveProposalTargetIndex(
      lecture.slides,
      proposedSlide,
      action,
      targetSlideIndex,
      targetSlideId
    )
    if (targetIdx < 0) {
      setPreviewSlide(null)
      showToast(
        'Không thể áp dụng vì slide đích không còn tồn tại. Vui lòng gửi lại yêu cầu.',
        'error'
      )
      return
    }

    recordHistory(lecture.slides)

    const updatedMessages = aiMessages.map((m) => {
      if (m.id !== messageId) return m

      const updatedProposals = m.proposals?.map((proposal) =>
        proposal.proposedSlide.id === proposedSlide.id
          ? { ...proposal, status: 'accepted' as const }
          : proposal
      )
      const hasPendingProposal = updatedProposals?.some(
        (proposal) => proposal.status !== 'accepted'
      )

      return {
        ...m,
        proposals: updatedProposals,
        status: hasPendingProposal
          ? ('pending' as const)
          : ('accepted' as const)
      }
    })
    setAiMessages(updatedMessages)

    const finalizedSlide: Slide = {
      ...proposedSlide,
      components: getSlideComponents(proposedSlide, lecture.theme)
    }

    let nextSlides: Slide[]
    if (action === 'CREATE_SLIDE') {
      nextSlides = [...lecture.slides]
      const insertIdx = targetIdx + 1
      nextSlides.splice(insertIdx, 0, finalizedSlide)
      mutateLecture({
        ...lecture,
        slides: nextSlides,
        aiChatHistory: updatedMessages as unknown as Array<
          Record<string, unknown>
        >
      })
      setActiveSlideIndex(insertIdx)
      showToast('Đã thêm slide mới từ đề xuất của AI', 'success')
    } else {
      nextSlides = lecture.slides.map((s, idx) =>
        idx === targetIdx ? finalizedSlide : s
      )
      mutateLecture({
        ...lecture,
        slides: nextSlides,
        aiChatHistory: updatedMessages as unknown as Array<
          Record<string, unknown>
        >
      })
      setActiveSlideIndex(targetIdx)
      showToast(`Đã áp dụng chỉnh sửa AI vào Slide ${targetIdx + 1}`, 'success')
    }

    setPreviewSlide(null)
    setSelectedCompId(null)
  }

  // Chấp nhận toàn bộ danh sách đề xuất từ AI (Accept All)
  const handleAcceptAllProposals = (
    messageId: string,
    proposals: AiSlideProposalItem[]
  ) => {
    const pendingProposals = proposals.filter(
      (proposal) => proposal.status !== 'accepted'
    )
    if (!lecture || pendingProposals.length === 0) return
    updateAiMessageStatus(messageId, 'accepted')
    recordHistory(lecture.slides)

    const updatedMessages = aiMessages.map((m) => {
      if (m.id === messageId) {
        return {
          ...m,
          status: 'accepted' as const,
          proposals: m.proposals?.map((p) => ({
            ...p,
            status: 'accepted' as const
          }))
        }
      }
      return m
    })

    const nextSlides = [...lecture.slides]

    // 1. Áp dụng các thay đổi UPDATE_SLIDE trước
    pendingProposals
      .filter((p) => p.action === 'UPDATE_SLIDE')
      .forEach((p) => {
        if (p.targetSlideIndex >= 0 && p.targetSlideIndex < nextSlides.length) {
          const slideWithComps: Slide = {
            ...p.proposedSlide,
            components: getSlideComponents(p.proposedSlide, lecture.theme)
          }
          nextSlides[p.targetSlideIndex] = slideWithComps
        }
      })

    // 2. Chèn các slide mới CREATE_SLIDE theo thứ tự tăng dần
    const createProps = pendingProposals.filter(
      (p) => p.action === 'CREATE_SLIDE'
    )
    let insertedOffset = 0
    createProps.forEach((p) => {
      const insertAt = Math.min(
        nextSlides.length,
        Math.max(0, p.targetSlideIndex + 1 + insertedOffset)
      )
      const slideWithComps: Slide = {
        ...p.proposedSlide,
        components: getSlideComponents(p.proposedSlide, lecture.theme)
      }
      nextSlides.splice(insertAt, 0, slideWithComps)
      insertedOffset++
    })

    mutateLecture({
      ...lecture,
      slides: nextSlides,
      aiChatHistory: updatedMessages as unknown as Array<
        Record<string, unknown>
      >
    })
    setPreviewSlide(null)
    setSelectedCompId(null)
    showToast(
      `Đã áp dụng thành công ${pendingProposals.length} đề xuất slide từ AI`,
      'success'
    )
  }

  // Từ chối đề xuất từ AI (Reject)
  const handleRejectProposal = (messageId: string) => {
    updateAiMessageStatus(messageId, 'rejected')
    if (previewSlide) {
      setPreviewSlide(null)
    }
    const updatedMessages = aiMessages.map((m) =>
      m.id === messageId ? { ...m, status: 'rejected' as const } : m
    )
    if (lecture) {
      mutateLecture(
        {
          ...lecture,
          aiChatHistory: updatedMessages as unknown as Array<
            Record<string, unknown>
          >
        },
        false
      )
    }
    showToast('Đã từ chối đề xuất', 'info')
  }

  // Chấp nhận bản preview đang hiển thị trên canvas
  const handleAcceptCurrentPreview = () => {
    if (!previewSlide) return
    const pendingMsg = [...aiMessages]
      .reverse()
      .find(
        (m) =>
          m.status === 'pending' &&
          ((m.proposedSlide && m.proposedSlide.id === previewSlide.id) ||
            m.proposals?.some((p) => p.proposedSlide.id === previewSlide.id))
      )
    const matchingProp = pendingMsg?.proposals?.find(
      (p) => p.proposedSlide.id === previewSlide.id
    )

    if (matchingProp && pendingMsg) {
      handleAcceptProposal(
        pendingMsg.id,
        previewSlide,
        matchingProp.action,
        matchingProp.targetSlideIndex,
        matchingProp.targetSlideId
      )
    } else if (pendingMsg && pendingMsg.proposedSlide) {
      handleAcceptProposal(
        pendingMsg.id,
        previewSlide,
        pendingMsg.action,
        pendingMsg.targetSlideIndex,
        pendingMsg.targetSlideId
      )
    } else {
      handleAcceptProposal(
        `temp-${Date.now()}`,
        previewSlide,
        previewSlideAction || 'UPDATE_SLIDE',
        undefined,
        previewTargetSlideId || undefined
      )
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
    // SRS UC008 3a: nếu người dùng bôi đen một đoạn thì AI chỉ xử lý đoạn đó
    const selectedText = window.getSelection()?.toString().trim()
    const selectionPromptMap = {
      rewrite: 'Viết lại cho mạch lạc, sắc nét hơn',
      shorten: 'Rút gọn cho súc tích',
      expand: 'Mở rộng chi tiết hơn'
    }
    void handleApplyAiPrompt(
      selectedText
        ? `${selectionPromptMap[action]} đúng đoạn văn bản sau trong slide, giữ nguyên các phần còn lại: "${selectedText}"`
        : promptMap[action]
    )
  }

  const handleBack = async () => {
    if (isLeaving) return
    setIsLeaving(true)
    const saved = saveStatus === 'saved' || (await flushChanges())
    setIsLeaving(false)
    if (!saved) {
      if (!onBack) navigate('/library')
      return
    }
    leaveApprovedRef.current = true
    if (onBack) onBack()
    else navigate('/library')
  }

  const handlePresent = async () => {
    if (!lecture || isLeaving) return
    if (!lecture.slides.length) {
      showToast('Bài giảng chưa có slide để trình chiếu', 'info')
      return
    }
    setIsLeaving(true)
    const saved = saveStatus === 'saved' || (await flushChanges())
    setIsLeaving(false)
    if (!saved) return
    const current = lectureRef.current!
    leaveApprovedRef.current = true
    if (onPresent) onPresent(current)
    else
      navigate(`/presentation/${current._id}`, {
        state: {
          lecture: current,
          startIndex: activeSlideIndex,
          fromEditor: true
        }
      })
  }

  // Tự động tạo lại Dàn ý bài giảng bằng AI khi người dùng yêu cầu
  const handleRegenerateOutline = async () => {
    if (!lecture) return
    if (saveStatus !== 'saved' && !(await flushChanges())) return
    const snapshot = lectureRef.current
    if (!snapshot) return
    const controller = new AbortController()
    aiRequestRef.current = controller
    setIsOutlineLoading(true)
    try {
      const prompt = snapshot.title || 'Bài giảng trình chiếu'
      const result = await generationApi.outline(
        prompt,
        {
          currentOutline: snapshot.outline || undefined,
          lectureId: snapshot._id
        },
        controller.signal
      )
      if (controller.signal.aborted || lectureRef.current?._id !== snapshot._id)
        return
      updateUser({ creditBalance: result.creditBalance })
      if (result.outline) {
        const current = lectureRef.current
        if (result.lecture && hasSameSavedContent(current, snapshot)) {
          lectureRef.current = result.lecture
          setLecture(result.lecture)
          autosaver.reset(result.lecture)
          setSourceMaterial(result.lecture.sourceMaterial || '')
          setSaveStatus('saved')
        } else {
          saveOfflineDraft(current)
          saveBlockedRef.current = true
          clearCountdownTimers()
          setSaveStatus('error')
          setSaveError(
            'Nội dung đã thay đổi trong lúc AI xử lý. Bản chỉnh sửa của bạn được giữ lại; hãy tải lại để chọn dữ liệu cần dùng.'
          )
          return
        }
        showToast('Đã tạo dàn ý bài giảng mới thành công', 'success')
      }
    } catch (error) {
      if (controller.signal.aborted) return
      const message = isAxiosError(error)
        ? error.response?.data?.message
        : undefined
      showToast(message || 'Không thể tạo lại dàn ý lúc này', 'error')
    } finally {
      setIsOutlineLoading(false)
    }
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
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title='Bài giảng có thay đổi chưa lưu'
        message='Bài giảng chưa lưu lên máy chủ. Bạn có thể lưu trước khi rời trang, hoặc giữ bản nháp trong trình duyệt để khôi phục sau.'
        confirmLabel='Lưu và rời trang'
        secondaryLabel='Rời và giữ bản nháp'
        onSecondary={async () => {
          if ((await flushChanges(true)) && blocker.state === 'blocked') {
            leaveApprovedRef.current = true
            blocker.proceed()
          }
        }}
        cancelLabel='Ở lại'
        pending={isLeaving}
        onConfirm={() => {
          if (isLeaving) return
          setIsLeaving(true)
          void flushChanges()
            .then((saved) => {
              if (saved && blocker.state === 'blocked') {
                leaveApprovedRef.current = true
                blocker.proceed()
              }
            })
            .finally(() => setIsLeaving(false))
        }}
        onCancel={() => {
          if (blocker.state === 'blocked') blocker.reset()
        }}
      />
      {/* 1. HEADER CANVA */}
      <EditorHeader
        title={lecture.title}
        onTitleChange={(newTitle) => {
          const next = { ...lecture, title: newTitle }
          mutateLecture(next, false)
        }}
        onBack={() => void handleBack()}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onManualSave={handleManualSave}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenOutline={() => setIsOutlineModalOpen(true)}
        onPresent={() => void handlePresent()}
        saveStatus={saveStatus}
        countdown={countdown}
        isAutoSave={isAutoSave}
        onToggleAutoSave={handleToggleAutoSave}
      />

      {saveError && (
        <div
          role='alert'
          className='flex items-center justify-between gap-3 bg-red-50 px-4 py-2 font-sans text-xs text-red-800'
        >
          <span>{saveError}</span>
          <button
            type='button'
            className='shrink-0 underline'
            onClick={() => void loadLecture()}
          >
            Tải lại bài giảng
          </button>
        </div>
      )}

      {/* 2. KHÔNG GIAN LÀM VIỆC CHÍNH (CANVA 3 KHU VỰC) */}
      <div className='flex flex-1 overflow-hidden'>
        {/* CỘT TRÁI: Icon Rail hẹp + Drawer chọn Văn bản / Hình khối / Upload ảnh / Mẫu slide / Giao diện */}
        <LeftSidebarRail
          key={lectureId}
          onAddTextComponent={handleAddTextComponent}
          onAddImageComponent={handleAddImageComponent}
          onAddShapeComponent={handleAddShapeComponent}
          onApplyContentLayout={handleApplyContentLayout}
          outline={lecture.outline}
          currentThemeId={lecture.theme}
          onThemeChange={handleThemeChange}
          layers={
            currentSlide ? getSlideComponents(currentSlide, lecture.theme) : []
          }
        />

        {/* KHU VỰC TRUNG TÂM: Floating Contextual Toolbar + Slide Canvas + Bottom Filmstrip */}
        <main className='relative flex min-w-0 flex-1 flex-col overflow-hidden bg-brand-paper'>
          {/* Thanh công cụ định dạng ngữ cảnh nổi (Canva Floating Pill Toolbar) - Chỉ hiện khi focus vào element */}
          {selectedComponent && (
            <div className='absolute top-2 left-3 right-3 z-30 flex justify-center pointer-events-none transition-all'>
              <div className='pointer-events-auto max-w-full overflow-x-auto no-scrollbar'>
                <FloatingContextualToolbar
                  selectedComponent={selectedComponent}
                  onUpdateComponent={(patch) => {
                    if (selectedCompId)
                      handleUpdateComponent(selectedCompId, patch)
                  }}
                  onDuplicateComponent={handleDuplicateComponent}
                  onDeleteComponent={handleDeleteComponent}
                  onChangeLayer={(direction) => {
                    if (selectedCompId)
                      handleChangeLayer(selectedCompId, direction)
                  }}
                />
              </div>
            </div>
          )}

          {/* Khung Canvas tỷ lệ 16:9 */}
          <SlideCanvas
            slide={activeSlideToDisplay}
            originalSlide={
              isPreviewVisible && previewSlideAction === 'CREATE_SLIDE'
                ? undefined
                : currentSlide
            }
            components={currentComponents}
            themeId={lecture.theme}
            slideIndex={activeSlideIndex}
            totalSlides={lecture.slides.length}
            selectedCompId={isPreviewVisible ? null : selectedCompId}
            onSelectComponent={isPreviewVisible ? () => {} : setSelectedCompId}
            onUpdateComponent={handleUpdateComponent}
            onDuplicateComponent={handleDuplicateComponent}
            onDeleteComponent={handleDeleteComponent}
            onAiQuickAction={handleAiQuickAction}
            isAiLoading={isAiLoading}
            isPreview={isPreviewVisible}
            onAcceptPreview={handleAcceptCurrentPreview}
            onExitPreview={() => setPreviewSlide(null)}
          />

          {/* Dải Slide ngang ở đáy màn hình (Bottom Filmstrip) */}
          <SlideFilmstrip
            slides={lecture.slides}
            lectureTheme={lecture.theme}
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
          key={lecture._id}
          onSourceMaterialChange={(sourceMaterial) => {
            if (lectureRef.current)
              mutateLecture({ ...lectureRef.current, sourceMaterial }, false)
          }}
          onApplyAiPrompt={handleApplyAiPrompt}
          onAcceptProposal={handleAcceptProposal}
          onAcceptAllProposals={handleAcceptAllProposals}
          onRejectProposal={handleRejectProposal}
          currentSlideIndex={activeSlideIndex}
          totalSlides={lecture.slides.length}
          currentSlideTitle={currentSlide?.title}
          selectedComponentName={selectedComponent?.type}
          lectureTitle={lecture.title}
          contextSummary={lecture.contextSummary}
          onSelectSlide={setActiveSlideIndex}
          isAiLoading={isAiLoading}
        />
      </div>

      {/* MODAL XUẤT BÀI GIẢNG */}
      {/* Mount lại mỗi lần mở để 'slide hiện tại' luôn đúng slide đang chọn (SRS UC029) */}
      {isExportModalOpen && (
        <ExportModal
          open={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          lecture={lecture}
          initialSlideIndex={activeSlideIndex}
          onSuccess={(msg) => showToast(msg, 'success')}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {/* MODAL TÀI LIỆU NGUỒN */}
      <SourceMaterialModal
        open={isSourceMaterialModalOpen}
        onClose={() => setIsSourceMaterialModalOpen(false)}
        sourceMaterial={sourceMaterial}
        onSave={(content) => {
          setSourceMaterial(content)
          if (lectureRef.current) {
            const next = { ...lectureRef.current, sourceMaterial: content }
            mutateLecture(next, false)
            void executeSave(next, false)
          }
        }}
      />

      {/* MODAL DÀN Ý */}
      <OutlineModal
        open={isOutlineModalOpen}
        onClose={() => setIsOutlineModalOpen(false)}
        outline={lecture.outline}
        lectureTitle={lecture.title}
        isLoading={isOutlineLoading}
        onRegenerateOutline={handleRegenerateOutline}
      />

      <ConfirmDialog
        open={pendingDraft !== null}
        title='Phát hiện dữ liệu chưa đồng bộ'
        message='Trình duyệt còn lưu bản chỉnh sửa chưa đồng bộ. Khôi phục sẽ dùng bản nháp để thay thế nội dung hiện tại trên máy chủ sau khi lưu; Bỏ qua sẽ giữ dữ liệu máy chủ. Bạn muốn dùng bản nào?'
        confirmLabel='Khôi phục'
        cancelLabel='Bỏ qua'
        onConfirm={() => {
          if (pendingDraft) {
            const restored = {
              ...pendingDraft,
              revision: lecture.revision ?? 0,
              updatedAt: lecture.updatedAt,
              aiChatHistory: lecture.aiChatHistory
            }
            autosaver.reset(lecture)
            setSourceMaterial(restored.sourceMaterial || '')
            mutateLecture(restored, false)
            if (isAutoSave) void executeSave(restored, true)
          }
          setPendingDraft(null)
        }}
        onCancel={() => {
          if (params.id) clearOfflineDraft(params.id)
          setPendingDraft(null)
        }}
      />

      {showAiWizard && (
        <AiGenerationWizard
          lecture={lecture}
          onOutlineSaved={(saved) => {
            setLecture(saved)
            lectureRef.current = saved
            autosaver.reset(saved)
            setSourceMaterial(saved.sourceMaterial || '')
            setSaveStatus('saved')
          }}
          onDone={(created) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { creditSpent, creditBalance, ...generated } =
              created as Lecture & {
                creditSpent?: number
                creditBalance?: number
              }
            setLecture(generated)
            lectureRef.current = generated
            autosaver.reset(generated)
            setSaveStatus('saved')
            setActiveSlideIndex(0)
            setShowAiWizard(false)
            navigate(location.pathname, { replace: true, state: null })
          }}
          onSkip={() => {
            setShowAiWizard(false)
            navigate(location.pathname, { replace: true, state: null })
          }}
        />
      )}
    </div>
  )
}
