import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  GitCompare,
  Layers,
  Lightbulb,
  Loader2,
  RotateCcw,
  Send,
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
    setIsSourceMaterialModalOpen
  } = useEditorStore()

  const [instruction, setInstruction] = useState('')
  const [activePromptTab, setActivePromptTab] = useState<PromptToolbarTab>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, isAiLoading])

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

                {/* TRƯỜNG HỢP 1: ĐỀ XUẤT NHIỀU SLIDE (BATCH CHANGES) */}
                {hasBatchProposals && msg.proposals && (
                  <div className='mt-2.5 rounded-xl border border-purple-200 bg-white p-3 shadow-xs text-stone-900'>
                    <div className='flex items-center justify-between pb-2 border-b border-purple-100'>
                      <div className='flex items-center gap-1.5'>
                        <Layers size={13} className='text-purple-600' />
                        <span className='font-bold text-purple-900 text-[11px]'>
                          Đề xuất {msg.proposals.length} slide mới
                        </span>
                      </div>
                      <div className='flex items-center gap-1'>
                        {msg.status === 'accepted' ? (
                          <span className='flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800'>
                            <Check size={10} /> Đã áp dụng tất cả
                          </span>
                        ) : msg.status === 'rejected' ? (
                          <span className='rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-500'>
                            Đã từ chối
                          </span>
                        ) : (
                          onAcceptAllProposals && (
                            <button
                              type='button'
                              onClick={() =>
                                onAcceptAllProposals(msg.id, msg.proposals!)
                              }
                              className='flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition cursor-pointer'
                            >
                              <Check size={11} />
                              <span>Chấp nhận tất cả</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className='space-y-2 mt-2 max-h-72 overflow-y-auto pr-1'>
                      {msg.proposals.map((prop, pIdx) => {
                        const isPropPreviewing =
                          previewSlide?.id === prop.proposedSlide.id
                        const isPropAccepted = prop.status === 'accepted'
                        return (
                          <div
                            key={prop.id || pIdx}
                            className='rounded-lg border border-stone-200 bg-stone-50/50 p-2.5 text-[11px] shadow-2xs space-y-1.5'
                          >
                            <div className='flex items-center justify-between'>
                              <span className='rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-800'>
                                {prop.action === 'CREATE_SLIDE'
                                  ? `+ Tạo sau Slide ${prop.targetSlideIndex + 1}`
                                  : `Sửa Slide ${prop.targetSlideIndex + 1}`}
                              </span>
                              {isPropAccepted && (
                                <span className='text-[9px] font-semibold text-emerald-600'>
                                  ✓ Đã thêm
                                </span>
                              )}
                            </div>
                            <div className='font-bold text-stone-900 line-clamp-1'>
                              {prop.proposedSlide.title || '(Chưa có tiêu đề)'}
                            </div>
                            {prop.summary && (
                              <div className='text-[10px] text-stone-500 line-clamp-2'>
                                {prop.summary}
                              </div>
                            )}
                            <div className='flex items-center gap-1.5 pt-1 border-t border-stone-100'>
                              <button
                                type='button'
                                onClick={() =>
                                  handleTogglePreview(
                                    prop.proposedSlide,
                                    prop.targetSlideIndex,
                                    prop.action
                                  )
                                }
                                className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition cursor-pointer ${
                                  isPropPreviewing
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
                                }`}
                              >
                                {isPropPreviewing ? (
                                  <EyeOff size={11} />
                                ) : (
                                  <Eye size={11} />
                                )}
                                <span>
                                  {isPropPreviewing ? 'Thoát xem' : 'Xem trước'}
                                </span>
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
                                  className='flex items-center justify-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 transition cursor-pointer'
                                >
                                  <Check size={11} />
                                  <span>Chấp nhận</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* TRƯỜNG HỢP 2: ĐỀ XUẤT 1 SLIDE ĐƠN LẺ (Proposal Card) */}
                {hasSingleProposal && singleSlide && (
                  <div className='mt-2.5 rounded-xl border border-stone-200 bg-white p-3 shadow-xs text-stone-900'>
                    <div className='flex items-center justify-between pb-1.5 border-b border-stone-100'>
                      <div className='flex items-center gap-1.5'>
                        <span className='text-[10px] font-bold uppercase tracking-wider text-brand-rust'>
                          {singleAction === 'CREATE_SLIDE'
                            ? typeof singleTargetIdx === 'number'
                              ? `✨ Đề xuất tạo slide mới (sau Slide ${singleTargetIdx + 1})`
                              : '✨ Đề xuất tạo slide mới'
                            : typeof singleTargetIdx === 'number'
                              ? `⚡ Đề xuất sửa Slide ${singleTargetIdx + 1}`
                              : '⚡ Đề xuất cập nhật slide'}
                        </span>
                        {typeof singleTargetIdx === 'number' &&
                          singleTargetIdx !== currentSlideIndex &&
                          onSelectSlide && (
                            <button
                              type='button'
                              onClick={() => onSelectSlide(singleTargetIdx)}
                              className='inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 hover:bg-blue-100 transition cursor-pointer'
                              title={`Chuyển màn hình tới Slide ${singleTargetIdx + 1}`}
                            >
                              <ExternalLink size={9} />
                              <span>Tới Slide {singleTargetIdx + 1}</span>
                            </button>
                          )}
                      </div>
                      {msg.status === 'accepted' && (
                        <span className='flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800'>
                          <Check size={10} /> Đã áp dụng
                        </span>
                      )}
                      {msg.status === 'rejected' && (
                        <span className='rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-500'>
                          Đã từ chối
                        </span>
                      )}
                    </div>

                    <div className='my-2 space-y-1 text-[11px]'>
                      <div className='font-bold text-stone-900 line-clamp-1'>
                        {singleSlide.title || '(Chưa có tiêu đề)'}
                      </div>
                      {singleSlide.subtitle && (
                        <div className='text-stone-500 text-[10px] line-clamp-1 italic'>
                          {singleSlide.subtitle}
                        </div>
                      )}
                      {singleSlide.bullets &&
                        singleSlide.bullets.length > 0 && (
                          <div className='text-stone-600 text-[10px] line-clamp-2'>
                            • {singleSlide.bullets.slice(0, 2).join(' • ')}
                            {singleSlide.bullets.length > 2 && ' ...'}
                          </div>
                        )}
                    </div>

                    {/* Các hành động trên đề xuất */}
                    <div className='flex items-center gap-1.5 pt-1.5 border-t border-stone-100'>
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
                        className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition cursor-pointer ${
                          isPreviewing
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
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

                      {msg.status !== 'accepted' &&
                        msg.status !== 'rejected' && (
                          <>
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
                              className='flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 px-2 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition cursor-pointer'
                              title='Áp dụng đề xuất này'
                            >
                              <Check size={12} />
                              <span>
                                {singleAction === 'CREATE_SLIDE'
                                  ? 'Chèn slide'
                                  : 'Chấp nhận'}
                              </span>
                            </button>
                            <button
                              type='button'
                              onClick={() => onRejectProposal(msg.id)}
                              className='flex h-7 w-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition cursor-pointer'
                              title='Từ chối đề xuất'
                            >
                              <X size={14} />
                            </button>
                          </>
                        )}
                    </div>

                    {msg.status !== 'accepted' && (
                      <div className='mt-1.5 text-right'>
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
          <div className='flex items-center gap-2 rounded-xl bg-orange-50/80 p-3 text-xs text-brand-rust border border-brand-rust/30'>
            <Loader2 size={16} className='animate-spin shrink-0' />
            <span className='font-medium'>
              AI đang phân tích ngữ cảnh và xử lý yêu cầu...
            </span>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* KHU VỰC ĐÁY: Thanh công cụ IDE Dock + Khung nhập Prompt */}
      <div className='border-t border-stone-200 bg-stone-50'>
        {/* Thanh công cụ đính kèm trên đầu ô nhập prompt (Prompt Header Toolbar) */}
        <div className='flex items-center justify-between border-b border-stone-200/80 bg-stone-100/80 px-2.5 py-1.5'>
          <div className='flex items-center gap-1.5'>
            {/* Nút 1: Gợi ý nhanh */}
            <button
              type='button'
              onClick={() =>
                setActivePromptTab(
                  activePromptTab === 'suggestions' ? null : 'suggestions'
                )
              }
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                activePromptTab === 'suggestions'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs font-bold'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
              title='Bật / Tắt danh sách gợi ý lệnh nhanh'
            >
              <Lightbulb size={12} className='text-amber-500 shrink-0' />
              <span>Gợi ý</span>
              {activePromptTab === 'suggestions' ? (
                <ChevronDown size={11} />
              ) : (
                <ChevronUp size={11} />
              )}
            </button>

            {/* Nút 2: Xem Ngữ cảnh AI (Context Viewer) */}
            <button
              type='button'
              onClick={() =>
                setActivePromptTab(
                  activePromptTab === 'context' ? null : 'context'
                )
              }
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                activePromptTab === 'context'
                  ? 'bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs font-bold'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
              title='Xem toàn bộ ngữ cảnh AI đang nhận biết'
            >
              <Layers size={12} className='text-blue-600 shrink-0' />
              <span>Ngữ cảnh</span>
            </button>

            {/* Nút 3: Slide thay đổi */}
            <button
              type='button'
              onClick={() =>
                setActivePromptTab(
                  activePromptTab === 'changedSlides' ? null : 'changedSlides'
                )
              }
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                activePromptTab === 'changedSlides'
                  ? 'bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs font-bold'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
              title='Xem các slide có đề xuất hoặc thay đổi từ AI'
            >
              <GitCompare size={12} className='text-purple-600 shrink-0' />
              <span>Đổi ({changedSlides.length})</span>
            </button>
          </div>

          {activePromptTab !== null && (
            <button
              type='button'
              onClick={() => setActivePromptTab(null)}
              className='text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer'
              title='Đóng bảng'
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* POPOVER NỘI DUNG: Gợi ý nhanh */}
        {activePromptTab === 'suggestions' && (
          <div className='max-h-44 overflow-y-auto border-b border-stone-200 bg-amber-50/50 p-2.5 custom-scrollbar space-y-1.5'>
            <span className='block text-[10px] font-bold uppercase tracking-wider text-amber-800/80 mb-1'>
              Chọn lệnh nhanh:
            </span>
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
          <div className='max-h-52 overflow-y-auto border-b border-stone-200 bg-blue-50/40 p-2.5 text-xs text-stone-800 custom-scrollbar space-y-2'>
            <div className='flex items-center justify-between border-b border-blue-100 pb-1'>
              <span className='text-[10px] font-bold uppercase tracking-wider text-blue-900'>
                Ngữ cảnh hiện tại
              </span>
              <span className='text-[10px] text-blue-700 font-mono'>
                {totalSlides} slides
              </span>
            </div>

            <div className='space-y-1.5 text-[11px]'>
              <div className='rounded bg-white p-1.5 border border-blue-100'>
                <span className='font-bold text-stone-700'>Bài giảng: </span>
                <span className='text-stone-900'>
                  {lectureTitle || 'Bài giảng'}
                </span>
              </div>

              <div className='rounded bg-white p-1.5 border border-blue-100'>
                <span className='font-bold text-stone-700'>
                  Slide đang mở:{' '}
                </span>
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
                <span className='font-bold text-stone-700'>
                  Thành phần chọn:{' '}
                </span>
                <span className='text-stone-800'>
                  {selectedComponentName || 'Toàn bộ slide'}
                </span>
              </div>

              <div className='rounded bg-white p-1.5 border border-blue-100'>
                <span className='font-bold text-stone-700'>
                  Tài liệu nguồn:{' '}
                </span>
                <span className='text-stone-800'>
                  {sourceMaterial
                    ? `Đã ghim (${sourceMaterial.length} ký tự)`
                    : 'Chưa có tài liệu nguồn'}
                </span>
              </div>

              {contextSummary && (
                <div className='rounded bg-white p-1.5 border border-blue-100'>
                  <span className='font-bold text-stone-700'>
                    Tóm tắt cốt lõi:{' '}
                  </span>
                  <p className='text-stone-600 text-[10px] leading-relaxed mt-0.5'>
                    {contextSummary}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* POPOVER NỘI DUNG: Danh sách slide thay đổi */}
        {activePromptTab === 'changedSlides' && (
          <div className='max-h-44 overflow-y-auto border-b border-stone-200 bg-purple-50/40 p-2.5 custom-scrollbar space-y-1.5'>
            <span className='block text-[10px] font-bold uppercase tracking-wider text-purple-900 mb-1'>
              Slide có đề xuất từ AI:
            </span>
            {changedSlides.length > 0 ? (
              changedSlides.map((item, idx) => {
                const isPreviewing =
                  previewSlide && previewSlide.id === item.proposedSlide.id

                return (
                  <div
                    key={`${item.messageId}-${idx}`}
                    className='flex items-center justify-between rounded-md border border-purple-200/80 bg-white p-2 text-xs shadow-2xs'
                  >
                    <div className='min-w-0 flex-1 pr-2'>
                      <div className='font-bold text-stone-900 truncate text-[11px]'>
                        {item.slideTitle}
                      </div>
                      <div className='flex items-center gap-1.5 text-[10px] text-stone-500'>
                        <span>
                          {item.action === 'CREATE_SLIDE'
                            ? 'Slide mới'
                            : 'Cập nhật'}
                        </span>
                        <span>•</span>
                        <span
                          className={
                            item.status === 'accepted'
                              ? 'text-emerald-600 font-semibold'
                              : item.status === 'rejected'
                                ? 'text-stone-400'
                                : 'text-amber-600 font-medium'
                          }
                        >
                          {item.status === 'accepted'
                            ? 'Đã áp dụng'
                            : item.status === 'rejected'
                              ? 'Đã từ chối'
                              : 'Chờ duyệt'}
                        </span>
                      </div>
                    </div>

                    <div className='flex items-center gap-1'>
                      <button
                        type='button'
                        onClick={() => {
                          if (onSelectSlide) onSelectSlide(item.slideIndex)
                          handleTogglePreview(item.proposedSlide)
                        }}
                        className={`rounded px-2 py-1 text-[10px] font-semibold transition cursor-pointer ${
                          isPreviewing
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                        }`}
                      >
                        {isPreviewing ? 'Thoát' : 'Xem'}
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className='text-center py-3 text-[11px] text-stone-400'>
                Chưa có đề xuất thay đổi slide nào trong phiên này.
              </p>
            )}
          </div>
        )}

        {/* Khung nhập Prompt */}
        <div className='p-3'>
          <form onSubmit={handleSubmit} className='space-y-2'>
            <div className='relative'>
              <textarea
                id='ai-prompt-input'
                rows={3}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSubmit()
                  }
                }}
                placeholder='Nhập yêu cầu chỉnh sửa hoặc câu hỏi trao đổi với AI...'
                className='w-full resize-none rounded-lg border border-stone-300 bg-white p-2.5 text-xs text-stone-900 outline-none transition focus:border-brand-rust focus:ring-1 focus:ring-brand-rust leading-relaxed'
              />
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-[10px] text-stone-400'>
                Enter để gửi, Shift+Enter xuống dòng
              </span>
              <button
                type='submit'
                disabled={!instruction.trim() || isAiLoading}
                className='flex items-center gap-1.5 rounded-lg bg-brand-rust px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition hover:bg-[#b04f35] active:scale-95 disabled:opacity-50 cursor-pointer'
              >
                {isAiLoading ? (
                  <>
                    <Loader2 size={13} className='animate-spin' />
                    <span>Đang xử lý</span>
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Gửi lệnh</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </aside>
  )
}
