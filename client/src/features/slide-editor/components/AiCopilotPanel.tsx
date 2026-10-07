import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  GitCommit,
  GitCompare,
  Layers,
  Lightbulb,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  X
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useEditorStore, type AiSlideProposalItem } from '../store/editor.store'
import type { Slide } from '@/lib/types'

interface ChangedSlideItem {
  messageId: string
  slideIndex: number
  slideTitle: string
  action?: string
  status?: 'pending' | 'accepted' | 'rejected'
  proposedSlide: Slide
}

interface AiCopilotPanelProps {
  onApplyAiPrompt: (instruction: string) => Promise<void>
  onAcceptProposal: (
    messageId: string,
    proposedSlide: Slide,
    action?: string,
    targetSlideIndex?: number
  ) => void
  onAcceptAllProposals?: (
    messageId: string,
    proposals: AiSlideProposalItem[]
  ) => void
  onRejectProposal: (messageId: string) => void
  currentSlideIndex: number
  totalSlides: number
  currentSlideTitle?: string
  selectedComponentName?: string
  lectureTitle?: string
  contextSummary?: string
  onSelectSlide?: (index: number) => void
  isAiLoading: boolean
}

const AI_SUGGESTIONS = [
  'Rút gọn thành 3 ý chính súc tích',
  'Thêm ví dụ thực tế minh họa',
  'Tạo 1 slide bài tập củng cố kiến thức',
  'Kiểm tra tính logic với slide trước',
  'Viết lại với giọng điệu trang trọng'
]

const AI_COPILOT_LOADING_STEPS = [
  'Đang đọc hiểu bài giảng & phân tích ngữ cảnh slide...',
  'Đang tính toán bố cục phù hợp & kiểm tra chống tràn chữ...',
  'Đang viết lại nội dung cô đọng & chuẩn hóa thiết kế...',
  'Đang kết xuất đề xuất trực quan...'
]

type PromptToolbarTab = 'suggestions' | 'context' | 'changedSlides' | null

export const AiCopilotPanel = ({
  onApplyAiPrompt,
  onAcceptProposal,
  onAcceptAllProposals,
  onRejectProposal,
  currentSlideIndex,
  totalSlides,
  currentSlideTitle,
  selectedComponentName,
  lectureTitle,
  contextSummary,
  onSelectSlide,
  isAiLoading
}: AiCopilotPanelProps) => {
  const {
    isAiPanelOpen,
    toggleAiPanel,
    aiMessages,
    previewSlide,
    setPreviewSlide,
    sourceMaterial,
    setSourceMaterial,
    setIsSourceMaterialModalOpen
  } = useEditorStore()

  const [instruction, setInstruction] = useState('')
  const [activePromptTab, setActivePromptTab] = useState<PromptToolbarTab>(null)
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null)
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false)
  const [expandedProposals, setExpandedProposals] = useState<Record<string, boolean>>({})
  const [copilotLoadingStepIdx, setCopilotLoadingStepIdx] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentMenuRef = useRef<HTMLDivElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAiLoading) {
      setCopilotLoadingStepIdx(0)
      return
    }
    const interval = setInterval(() => {
      setCopilotLoadingStepIdx(
        (prev) => (prev + 1) % AI_COPILOT_LOADING_STEPS.length
      )
    }, 2400)
    return () => clearInterval(interval)
  }, [isAiLoading])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, isAiLoading])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(e.target as Node)
      ) {
        setIsAttachmentMenuOpen(false)
      }
    }
    if (isAttachmentMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isAttachmentMenuOpen])

  if (!isAiPanelOpen) return null

  // Tìm danh sách các slide đã có đề xuất hoặc thay đổi trong lịch sử
  const changedSlides: ChangedSlideItem[] = aiMessages
    .filter((m) => Boolean(m.proposedSlide))
    .map((m) => ({
      messageId: m.id,
      slideIndex:
        typeof m.targetSlideIndex === 'number'
          ? m.targetSlideIndex
          : currentSlideIndex,
      slideTitle: m.proposedSlide?.title || 'Slide đề xuất',
      action: m.action,
      status: m.status,
      proposedSlide: m.proposedSlide!
    }))

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!instruction.trim() || isAiLoading) return

    const promptText = instruction.trim()
    setInstruction('')
    setActivePromptTab(null)
    await onApplyAiPrompt(promptText)
  }

  const handleTogglePreview = (
    slide: Slide,
    targetIdx?: number,
    action?: 'CREATE_SLIDE' | 'UPDATE_SLIDE'
  ) => {
    if (previewSlide?.id === slide.id) {
      setPreviewSlide(null)
    } else {
      if (
        typeof targetIdx === 'number' &&
        targetIdx !== currentSlideIndex &&
        onSelectSlide
      ) {
        onSelectSlide(targetIdx)
      }
      setPreviewSlide(slide, action)
    }
  }

  const handleApplySuggestion = (sug: string) => {
    setInstruction(sug)
    setActivePromptTab(null)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAttachedFileName(file.name)
    setIsAttachmentMenuOpen(false)

    const reader = new FileReader()
    if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      reader.onload = (event) => {
        const text = event.target?.result as string
        if (text) {
          setSourceMaterial(text)
        }
      }
      reader.readAsText(file)
    } else {
      reader.onload = (event) => {
        const text = (event.target?.result as string) || ''
        const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ').trim()
        if (cleaned.length > 50) {
          setSourceMaterial(cleaned.slice(0, 50000))
        } else {
          setSourceMaterial(`[Tệp đính kèm: ${file.name} (${Math.round(file.size / 1024)} KB)]`)
        }
      }
      reader.readAsText(file)
    }
  }

  const handleRemoveAttachment = () => {
    setAttachedFileName(null)
    setSourceMaterial('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <aside className='flex w-88 shrink-0 flex-col border-l border-stone-200 bg-white font-sans text-stone-800 shadow-sm'>
      {/* Header Panel */}
      <div className='flex h-12 items-center justify-between border-b border-stone-200 px-4'>
        <div className='flex items-center gap-2'>
          <Sparkles size={16} className='text-brand-rust' />
          <span className='text-xs font-bold uppercase tracking-wider text-brand-ink'>
            Trợ lý AI
          </span>
        </div>
        <div className='flex items-center gap-1'>
          <button
            type='button'
            onClick={() => setIsSourceMaterialModalOpen(true)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
              sourceMaterial
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'text-stone-500 hover:bg-stone-100'
            }`}
            title='Tài liệu nguồn & Ghi chú tham khảo'
          >
            <BookOpen size={13} />
            <span>Tài liệu</span>
            {sourceMaterial && (
              <span className='h-1.5 w-1.5 rounded-full bg-emerald-500' />
            )}
          </button>
          <button
            type='button'
            onClick={toggleAiPanel}
            className='flex h-6 w-6 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer'
            title='Đóng bảng AI'
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Dải thông tin ngữ cảnh nhanh (Quick Context Badge Bar) */}
      <div className='flex flex-wrap items-center gap-1.5 border-b border-stone-100 bg-stone-50/70 px-3 py-1.5 text-[10px]'>
        <div
          className='flex items-center gap-1 rounded bg-stone-200/70 px-2 py-0.5 font-medium text-stone-700'
          title={currentSlideTitle || 'Tiêu đề slide'}
        >
          <span>
            Slide {currentSlideIndex + 1}/{totalSlides}
          </span>
          {currentSlideTitle && (
            <span className='max-w-30 truncate text-stone-500'>
              : {currentSlideTitle}
            </span>
          )}
        </div>
        {selectedComponentName && (
          <div className='flex items-center gap-1 rounded bg-brand-rust/10 px-2 py-0.5 font-medium text-brand-rust'>
            <span>Focus: {selectedComponentName}</span>
          </div>
        )}
      </div>

      {/* Thanh tiến trình gradient chạy khi AI đang suy nghĩ */}
      {isAiLoading && (
        <div className='h-0.5 w-full overflow-hidden bg-amber-100/60'>
          <div className='h-full w-full bg-gradient-to-r from-brand-rust via-amber-400 to-emerald-500 animate-pulse' />
        </div>
      )}

      {/* Danh sách tin nhắn trao đổi (Chat history) */}
      <div className='flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar'>
        {aiMessages.map((msg) => {
          const isUser = msg.role === 'user'
          const hasBatchProposals = Boolean(
            msg.proposals &&
            (msg.proposals.length > 1 ||
              (msg.action === 'BATCH_CHANGES' && msg.proposals.length >= 1))
          )
          const singleSlide =
            msg.proposedSlide ||
            (msg.proposals && msg.proposals.length === 1
              ? msg.proposals[0].proposedSlide
              : undefined)
          const singleAction =
            (msg.proposals && msg.proposals.length === 1
              ? msg.proposals[0].action
              : undefined) ||
            (msg.action === 'CREATE_SLIDE'
              ? 'CREATE_SLIDE'
              : msg.action === 'UPDATE_SLIDE'
                ? 'UPDATE_SLIDE'
                : 'CREATE_SLIDE')
          const singleTargetIdx =
            (msg.proposals && msg.proposals.length === 1
              ? msg.proposals[0].targetSlideIndex
              : undefined) ?? msg.targetSlideIndex
          const hasSingleProposal = Boolean(singleSlide && !hasBatchProposals)
          const isPreviewing =
            singleSlide && previewSlide?.id === singleSlide.id

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[95%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs ${
                  isUser
                    ? 'bg-brand-ink text-white rounded-br-xs'
                    : 'bg-stone-100 text-stone-800 border border-stone-200 rounded-bl-xs'
                }`}
              >
                <div className='whitespace-pre-wrap leading-relaxed'>
                  {msg.text}
                </div>

                {/* TRƯỜNG HỢP 1: ĐỀ XUẤT NHIỀU SLIDE (BATCH CHANGES CARD) */}
                {hasBatchProposals && msg.proposals && (
                  <div className='mt-2.5 rounded-xl border border-stone-200 bg-white shadow-xs overflow-hidden text-stone-900'>
                    {/* Header: X slides changed + Review button */}
                    <div className='flex items-center justify-between px-3 py-2 bg-stone-50/80 border-b border-stone-100'>
                      <div className='flex items-center gap-1.5'>
                        <GitCommit size={14} className='text-stone-600' />
                        <span className='font-semibold text-stone-800 text-xs'>
                          {msg.proposals.length} slides changed
                        </span>
                        <span className='rounded bg-stone-200/80 px-1.5 py-0.5 text-[10px] font-mono text-stone-600 font-medium'>
                          +{msg.proposals.filter((p) => p.action === 'CREATE_SLIDE').length} ~{msg.proposals.filter((p) => p.action !== 'CREATE_SLIDE').length}
                        </span>
                      </div>
                      <button
                        type='button'
                        onClick={() =>
                          setExpandedProposals((prev) => ({
                            ...prev,
                            [msg.id]: prev[msg.id] === undefined ? false : !prev[msg.id]
                          }))
                        }
                        className='flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 px-2 py-0.5 rounded hover:bg-stone-200/60 transition cursor-pointer'
                      >
                        <span>Review</span>
                        {(expandedProposals[msg.id] ?? true) ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )}
                      </button>
                    </div>

                    {/* Collapsible list of slide changes */}
                    {(expandedProposals[msg.id] ?? true) && (
                      <div className='divide-y divide-stone-100 max-h-60 overflow-y-auto custom-scrollbar'>
                        {msg.proposals.map((prop, pIdx) => {
                          const isPropPreviewing =
                            previewSlide?.id === prop.proposedSlide.id
                          const isPropAccepted = prop.status === 'accepted'
                          const isCreate = prop.action === 'CREATE_SLIDE'

                          return (
                            <div
                              key={prop.id || pIdx}
                              className={`flex items-center justify-between px-3 py-2 text-xs transition ${
                                isPropPreviewing
                                  ? 'bg-amber-50/80'
                                  : 'hover:bg-stone-50/60'
                              }`}
                            >
                              <div className='flex items-center gap-2 min-w-0 flex-1 pr-2'>
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold ${
                                    isCreate
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                  title={isCreate ? 'Tạo slide mới' : 'Chỉnh sửa slide'}
                                >
                                  {isCreate ? '+' : '~'}
                                </span>
                                <span className='font-medium text-stone-800 truncate text-[11px]'>
                                  Slide {prop.targetSlideIndex + 1}: {prop.proposedSlide.title || '(Chưa có tiêu đề)'}
                                </span>
                              </div>

                              <div className='flex items-center gap-1 shrink-0'>
                                <button
                                  type='button'
                                  onClick={() =>
                                    handleTogglePreview(
                                      prop.proposedSlide,
                                      prop.targetSlideIndex,
                                      prop.action
                                    )
                                  }
                                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition cursor-pointer ${
                                    isPropPreviewing
                                      ? 'bg-amber-200 text-amber-900 font-semibold'
                                      : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                                  }`}
                                  title={
                                    isPropPreviewing
                                      ? 'Thoát xem trước'
                                      : 'Xem trước trên Canvas'
                                  }
                                >
                                  {isPropPreviewing ? (
                                    <EyeOff size={11} />
                                  ) : (
                                    <Eye size={11} />
                                  )}
                                  <span>{isPropPreviewing ? 'Xem' : ''}</span>
                                </button>

                                {!isPropAccepted && msg.status !== 'accepted' && (
                                  <button
                                    type='button'
                                    onClick={() =>
                                      onAcceptProposal(
                                        msg.id,
                                        prop.proposedSlide,
                                        prop.action,
                                        prop.targetSlideIndex
                                      )
                                    }
                                    className='rounded p-1 text-stone-400 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer'
                                    title='Chấp nhận slide này'
                                  >
                                    <Check size={12} />
                                  </button>
                                )}
                                {isPropAccepted && (
                                  <span className='text-[10px] font-medium text-emerald-600'>
                                    ✓
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Bottom Actions Bar: Reject all & Accept all */}
                    <div className='flex items-center justify-between px-3 py-2 bg-stone-50/50 border-t border-stone-100'>
                      {msg.status === 'accepted' ? (
                        <span className='flex items-center gap-1.5 text-xs font-semibold text-emerald-600'>
                          <Check size={13} /> Đã áp dụng tất cả
                        </span>
                      ) : msg.status === 'rejected' ? (
                        <span className='text-xs font-medium text-stone-400'>
                          Đã từ chối tất cả
                        </span>
                      ) : (
                        <>
                          <button
                            type='button'
                            onClick={() => onRejectProposal(msg.id)}
                            className='text-xs text-stone-500 hover:text-stone-800 font-medium transition cursor-pointer'
                          >
                            Reject all
                          </button>
                          {onAcceptAllProposals && (
                            <button
                              type='button'
                              onClick={() =>
                                onAcceptAllProposals(msg.id, msg.proposals!)
                              }
                              className='flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-2xs hover:bg-blue-700 active:scale-95 transition cursor-pointer'
                            >
                              <Check size={13} />
                              <span>Accept all</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* TRƯỜNG HỢP 2: ĐỀ XUẤT 1 SLIDE ĐƠN LẺ (SINGLE PROPOSAL CARD) */}
                {hasSingleProposal && singleSlide && (
                  <div className='mt-2.5 rounded-xl border border-stone-200 bg-white shadow-xs overflow-hidden text-stone-900'>
                    {/* Header */}
                    <div className='flex items-center justify-between px-3 py-2 bg-stone-50/80 border-b border-stone-100'>
                      <div className='flex items-center gap-1.5 min-w-0'>
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold ${
                            singleAction === 'CREATE_SLIDE'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {singleAction === 'CREATE_SLIDE' ? '+' : '~'}
                        </span>
                        <span className='font-semibold text-stone-800 text-xs truncate'>
                          {singleAction === 'CREATE_SLIDE'
                            ? typeof singleTargetIdx === 'number'
                              ? `Tạo slide sau trang ${singleTargetIdx + 1}`
                              : 'Tạo slide mới'
                            : typeof singleTargetIdx === 'number'
                              ? `Sửa Slide ${singleTargetIdx + 1}`
                              : 'Cập nhật slide'}
                        </span>
                      </div>
                      {typeof singleTargetIdx === 'number' &&
                        singleTargetIdx !== currentSlideIndex &&
                        onSelectSlide && (
                          <button
                            type='button'
                            onClick={() => onSelectSlide(singleTargetIdx)}
                            className='inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 hover:bg-stone-200 transition cursor-pointer'
                            title={`Chuyển tới Slide ${singleTargetIdx + 1}`}
                          >
                            <ExternalLink size={10} />
                            <span>Tới trang</span>
                          </button>
                        )}
                    </div>

                    {/* Content summary */}
                    <div className='px-3 py-2 text-xs space-y-1 bg-white'>
                      <div className='font-medium text-stone-800 line-clamp-1'>
                        {singleSlide.title || '(Chưa có tiêu đề)'}
                      </div>
                      {singleSlide.subtitle && (
                        <div className='text-stone-500 text-[11px] line-clamp-1 italic'>
                          {singleSlide.subtitle}
                        </div>
                      )}
                      {singleSlide.bullets && singleSlide.bullets.length > 0 && (
                        <div className='text-stone-600 text-[10px] line-clamp-2'>
                          • {singleSlide.bullets.slice(0, 2).join(' • ')}
                          {singleSlide.bullets.length > 2 && ' ...'}
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions Bar */}
                    <div className='flex items-center justify-between px-3 py-2 bg-stone-50/50 border-t border-stone-100'>
                      <button
                        type='button'
                        onClick={() =>
                          handleTogglePreview(
                            singleSlide,
                            singleTargetIdx,
                            singleAction === 'CREATE_SLIDE'
                              ? 'CREATE_SLIDE'
                              : 'UPDATE_SLIDE'
                          )
                        }
                        className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded transition cursor-pointer ${
                          isPreviewing
                            ? 'bg-amber-100 text-amber-800 border border-amber-300 font-semibold'
                            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                        }`}
                        title='Xem trước trên Canvas'
                      >
                        {isPreviewing ? (
                          <EyeOff size={12} />
                        ) : (
                          <Eye size={12} />
                        )}
                        <span>{isPreviewing ? 'Thoát xem' : 'Xem trước'}</span>
                      </button>

                      <div className='flex items-center gap-2'>
                        {msg.status === 'accepted' ? (
                          <span className='flex items-center gap-1 text-xs font-semibold text-emerald-600'>
                            <Check size={12} /> Đã áp dụng
                          </span>
                        ) : msg.status === 'rejected' ? (
                          <span className='text-xs font-medium text-stone-400'>
                            Đã từ chối
                          </span>
                        ) : (
                          <>
                            <button
                              type='button'
                              onClick={() => onRejectProposal(msg.id)}
                              className='text-xs text-stone-500 hover:text-stone-800 font-medium transition cursor-pointer'
                            >
                              Reject
                            </button>
                            <button
                              type='button'
                              onClick={() =>
                                onAcceptProposal(
                                  msg.id,
                                  singleSlide,
                                  singleAction,
                                  singleTargetIdx
                                )
                              }
                              className='flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-2xs hover:bg-blue-700 active:scale-95 transition cursor-pointer'
                            >
                              <Check size={12} />
                              <span>Accept</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {msg.status !== 'accepted' && (
                      <div className='px-3 py-1 bg-stone-50/30 border-t border-stone-100 text-right'>
                        <button
                          type='button'
                          onClick={() =>
                            setInstruction(
                              `Điều chỉnh lại đề xuất cho slide "${singleSlide.title}": `
                            )
                          }
                          className='inline-flex items-center gap-1 text-[10px] text-stone-400 hover:text-brand-rust cursor-pointer'
                        >
                          <RotateCcw size={10} />
                          <span>Yêu cầu điều chỉnh lại</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <span className='mt-1 text-[9px] text-stone-400 px-1'>
                {msg.timestamp}
              </span>
            </div>
          )
        })}

        {isAiLoading && (
          <div className='flex flex-col gap-2 rounded-2xl bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-stone-50 p-3.5 text-xs border border-amber-200/70 shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-300'>
            {/* Top row: Animated avatar + status text + dancing dots */}
            <div className='flex items-center justify-between gap-2 border-b border-amber-200/50 pb-2.5'>
              <div className='flex items-center gap-2 min-w-0'>
                <div className='relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-brand-rust to-amber-500 text-white shadow-xs'>
                  <Sparkles size={12} className='animate-pulse' />
                  <span className='absolute -top-0.5 -right-0.5 flex h-2 w-2'>
                    <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75'></span>
                    <span className='relative inline-flex rounded-full h-2 w-2 bg-emerald-500'></span>
                  </span>
                </div>
                <div className='flex items-center gap-1.5 min-w-0'>
                  <span className='font-semibold text-brand-ink text-[11px] truncate'>
                    {AI_COPILOT_LOADING_STEPS[copilotLoadingStepIdx]}
                  </span>
                  <span className='flex items-center gap-0.5 shrink-0'>
                    <span className='h-1 w-1 rounded-full bg-brand-rust animate-bounce [animation-delay:-0.3s]' />
                    <span className='h-1 w-1 rounded-full bg-brand-rust animate-bounce [animation-delay:-0.15s]' />
                    <span className='h-1 w-1 rounded-full bg-brand-rust animate-bounce' />
                  </span>
                </div>
              </div>
              <span className='text-[10px] font-mono text-amber-700/80 bg-amber-100/70 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 font-semibold'>
                <Loader2 size={10} className='animate-spin' />
                Đang xử lý
              </span>
            </div>

            {/* Skeleton Preview: Khung slide đề xuất giả lập phát sáng */}
            <div className='relative overflow-hidden rounded-xl border border-stone-200/80 bg-white/90 p-2.5 space-y-2'>
              {/* Skeleton header & title */}
              <div className='space-y-1.5'>
                <div className='h-2 w-20 rounded-full bg-stone-200/80 animate-pulse' />
                <div className='h-3.5 w-48 rounded-full bg-stone-300/80 animate-pulse' />
              </div>

              {/* Skeleton 3 mini cards */}
              <div className='grid grid-cols-3 gap-1.5 pt-1'>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className='flex flex-col justify-between rounded-lg border border-stone-200/70 bg-stone-50/80 p-2 h-16 animate-pulse'
                    style={{ animationDelay: `${i * 150}ms` }}
                  >
                    <div className='h-2 w-10 rounded-full bg-amber-200/70' />
                    <div className='space-y-1'>
                      <div className='h-1.5 w-full rounded-full bg-stone-200/90' />
                      <div className='h-1.5 w-2/3 rounded-full bg-stone-200/90' />
                    </div>
                  </div>
                ))}
              </div>

              {/* Skeleton footer bar */}
              <div className='flex items-center justify-between pt-1 border-t border-stone-100'>
                <div className='h-1.5 w-24 rounded-full bg-stone-200 animate-pulse' />
                <div className='h-1.5 w-12 rounded-full bg-stone-200 animate-pulse' />
              </div>
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* POPOVER NỘI DUNG: Gợi ý nhanh (khi mở từ tab hoặc menu) */}
      {activePromptTab === 'suggestions' && (
        <div className='max-h-44 overflow-y-auto border-t border-stone-200 bg-amber-50/50 p-2.5 custom-scrollbar space-y-1.5'>
          <div className='flex items-center justify-between mb-1'>
            <span className='text-[10px] font-bold uppercase tracking-wider text-amber-800/80'>
              Chọn gợi ý mẫu:
            </span>
            <button
              type='button'
              onClick={() => setActivePromptTab(null)}
              className='text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer'
            >
              <X size={12} />
            </button>
          </div>
          {AI_SUGGESTIONS.map((sug) => (
            <button
              key={sug}
              type='button'
              onClick={() => handleApplySuggestion(sug)}
              className='flex w-full items-center gap-1.5 text-left rounded-md border border-amber-200/80 bg-white px-2.5 py-1 text-[11px] text-stone-700 transition hover:border-brand-rust hover:bg-brand-rust/5 hover:text-brand-rust cursor-pointer shadow-2xs'
            >
              <Lightbulb size={11} className='text-amber-500 shrink-0' />
              <span>{sug}</span>
            </button>
          ))}
        </div>
      )}

      {/* POPOVER NỘI DUNG: Xem Ngữ cảnh AI (Current Context) */}
      {activePromptTab === 'context' && (
        <div className='max-h-52 overflow-y-auto border-t border-stone-200 bg-blue-50/40 p-2.5 text-xs text-stone-800 custom-scrollbar space-y-2'>
          <div className='flex items-center justify-between border-b border-blue-100 pb-1'>
            <span className='text-[10px] font-bold uppercase tracking-wider text-blue-900'>
              Ngữ cảnh hiện tại
            </span>
            <button
              type='button'
              onClick={() => setActivePromptTab(null)}
              className='text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer'
            >
              <X size={12} />
            </button>
          </div>

          <div className='space-y-1.5 text-[11px]'>
            <div className='rounded bg-white p-1.5 border border-blue-100'>
              <span className='font-bold text-stone-700'>Bài giảng: </span>
              <span className='text-stone-900'>{lectureTitle || 'Bài giảng'}</span>
            </div>

            <div className='rounded bg-white p-1.5 border border-blue-100'>
              <span className='font-bold text-stone-700'>Slide đang mở: </span>
              <span className='text-brand-rust font-semibold'>
                Trang {currentSlideIndex + 1}/{totalSlides}
              </span>
              {currentSlideTitle && (
                <span className='text-stone-600 truncate block'>
                  {currentSlideTitle}
                </span>
              )}
            </div>

            <div className='rounded bg-white p-1.5 border border-blue-100'>
              <span className='font-bold text-stone-700'>Thành phần chọn: </span>
              <span className='text-stone-800'>
                {selectedComponentName || 'Toàn bộ slide'}
              </span>
            </div>

            {contextSummary && (
              <div className='rounded bg-white p-1.5 border border-blue-100'>
                <span className='font-bold text-stone-700'>Tóm tắt cốt lõi: </span>
                <p className='text-stone-600 text-[10px] leading-relaxed mt-0.5'>
                  {contextSummary}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KHU VỰC ĐÁY: Gợi ý nhanh + Khung nhập AI Agent All-in-one */}
      <div className='border-t border-stone-200 bg-white p-3 space-y-2'>
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type='file'
          accept='.docx,.pdf,.txt,.md'
          onChange={handleFileUpload}
          className='hidden'
        />

        {/* Quick Suggestion Chips (carousel/horizontal scroll) */}
        <div className='flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-[11px]'>
          {AI_SUGGESTIONS.slice(0, 3).map((sug) => (
            <button
              key={sug}
              type='button'
              onClick={() => handleApplySuggestion(sug)}
              className='shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-stone-600 hover:border-brand-rust hover:bg-brand-rust/5 hover:text-brand-rust transition cursor-pointer'
            >
              {sug}
            </button>
          ))}
        </div>

        {/* ALL-IN-ONE AGENT INPUT CONTAINER */}
        <div className='relative rounded-2xl border border-stone-200 bg-stone-50/40 p-2.5 transition-all focus-within:border-stone-400 focus-within:bg-white focus-within:ring-1 focus-within:ring-stone-300 shadow-2xs'>
          {/* Attachment Chip (if present) */}
          {(attachedFileName || sourceMaterial) && (
            <div className='mb-2 flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 shadow-2xs w-fit max-w-full'>
              <FileText size={12} className='text-brand-rust shrink-0' />
              <span className='truncate font-medium'>
                {attachedFileName || `Tài liệu nguồn (${sourceMaterial.length} ký tự)`}
              </span>
              <button
                type='button'
                onClick={handleRemoveAttachment}
                className='ml-1 text-stone-400 hover:text-stone-700 p-0.5 rounded cursor-pointer'
                title='Xóa tệp đính kèm'
              >
                <X size={11} />
              </button>
            </div>
          )}

          {/* Textarea */}
          <textarea
            id='ai-prompt-input'
            rows={2}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSubmit()
              }
            }}
            placeholder='Yêu cầu AI chỉnh sửa slide hoặc trao đổi...'
            className='w-full resize-none border-0 bg-transparent p-0 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-0 leading-relaxed max-h-32 custom-scrollbar'
          />

          {/* Bottom Controls Bar */}
          <div className='flex items-center justify-between pt-1 mt-1 border-t border-stone-100/80'>
            {/* Left Controls: '+' button with popup menu */}
            <div className='relative' ref={attachmentMenuRef}>
              <button
                type='button'
                onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                className='flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition cursor-pointer shadow-2xs'
                title='Thêm tệp hoặc tài liệu tham khảo'
              >
                <Plus size={13} />
              </button>

              {/* Popup Menu */}
              {isAttachmentMenuOpen && (
                <div className='absolute bottom-8 left-0 z-30 w-52 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150'>
                  <button
                    type='button'
                    onClick={() => {
                      setIsAttachmentMenuOpen(false)
                      fileInputRef.current?.click()
                    }}
                    className='flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-100 transition cursor-pointer'
                  >
                    <FileUp size={14} className='text-brand-rust' />
                    <span>Tải tệp (.docx, .pdf, .txt)</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      setIsAttachmentMenuOpen(false)
                      setIsSourceMaterialModalOpen(true)
                    }}
                    className='flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-100 transition cursor-pointer'
                  >
                    <BookOpen size={14} className='text-emerald-600' />
                    <span>Tài liệu nguồn & ghi chú</span>
                  </button>
                  <div className='border-t border-stone-100 my-1' />
                  <button
                    type='button'
                    onClick={() => {
                      setIsAttachmentMenuOpen(false)
                      setActivePromptTab(
                        activePromptTab === 'suggestions' ? null : 'suggestions'
                      )
                    }}
                    className='flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-100 transition cursor-pointer'
                  >
                    <Lightbulb size={14} className='text-amber-500' />
                    <span>Xem tất cả gợi ý</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      setIsAttachmentMenuOpen(false)
                      setActivePromptTab(
                        activePromptTab === 'context' ? null : 'context'
                      )
                    }}
                    className='flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-100 transition cursor-pointer'
                  >
                    <Layers size={14} className='text-blue-600' />
                    <span>Xem ngữ cảnh AI</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Controls: Circular Send Button (NO MODEL SELECTOR) */}
            <div className='flex items-center gap-2'>
              <span className='text-[10px] text-stone-400 select-none hidden sm:inline'>
                Enter ↵
              </span>
              <button
                type='button'
                onClick={() => void handleSubmit()}
                disabled={!instruction.trim() || isAiLoading}
                className='flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-white hover:bg-stone-800 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer shadow-xs'
                title='Gửi lệnh'
              >
                {isAiLoading ? (
                  <Loader2 size={13} className='animate-spin' />
                ) : (
                  <ArrowUp size={14} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
