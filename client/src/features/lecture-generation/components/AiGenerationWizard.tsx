import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { ArrowUp, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { generationApi } from '@/features/lecture-generation/api/generation.api'
import { useToast } from '@/components/ui/Toast'
import { AiDataNotice } from '@/components/ui/AiDataNotice'
import { useAuthStore } from '@/features/auth/store/auth.store'
import type { Lecture, Outline } from '@/lib/types'
import {
  THEME_PRESETS,
  DEFAULT_THEME_ID,
  FONT_MAP,
  FONT_OPTIONS
} from '@/features/slide-editor/constants/theme-options'

interface AiGenerationWizardProps {
  lecture: Lecture
  onDone: (lecture: Lecture) => void
  onSkip: () => void
  onOutlineSaved?: (lecture: Lecture) => void
}

interface ChatEntry {
  role: 'user' | 'assistant'
  text: string
}

// Cỡ chữ mặc định mà bộ dựng slide áp dụng cho mọi pattern (utils/slide.ts)
const TITLE_FONT_SIZE = 44
const BODY_FONT_SIZE = 15

const fontName = (key: string) =>
  FONT_OPTIONS.find((f) => f.key === key)?.name ?? key

const errorMessage = (err: unknown, fallback: string) =>
  (isAxiosError(err) &&
    (err.response?.data as { message?: string })?.message) ||
  fallback

// SRS UC006 (dàn ý qua chat) -> UC007 (chọn pattern) -> UC008 (sinh slide)
export const AiGenerationWizard = ({
  lecture,
  onDone,
  onSkip,
  onOutlineSaved
}: AiGenerationWizardProps) => {
  const { showToast } = useToast()
  const requestRef = useRef<AbortController | null>(null)
  useEffect(() => () => requestRef.current?.abort(), [])
  const updateUser = useAuthStore((state) => state.updateUser)

  const [step, setStep] = useState<'outline' | 'pattern'>('outline')
  const [prompt, setPrompt] = useState('')
  const [input, setInput] = useState('')
  const [chat, setChat] = useState<ChatEntry[]>([])
  const [outline, setOutline] = useState<Outline | null>(
    lecture.outline ?? null
  )
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID)
  const [busyChat, setBusyChat] = useState(false)
  const [busyCreate, setBusyCreate] = useState(false)

  // Tin nhắn đầu tiên là prompt sinh dàn ý, các tin sau là yêu cầu AI sinh lại (4a)
  const handleSend = async () => {
    const text = input.trim()
    if (!text || busyChat) return
    const isFirst = !outline || !prompt
    if (isFirst && text.length < 5) {
      showToast('Mô tả bài giảng cần ít nhất 5 ký tự', 'error')
      return
    }
    const controller = new AbortController()
    requestRef.current = controller
    setBusyChat(true)
    setInput('')
    setChat((prev) => [...prev, { role: 'user', text }])
    try {
      const result = isFirst
        ? await generationApi.outline(
            text,
            { lectureId: lecture._id },
            controller.signal
          )
        : await generationApi.outline(
            prompt,
            {
              feedback: text,
              currentOutline: outline,
              lectureId: lecture._id
            },
            controller.signal
          )
      if (isFirst) setPrompt(text)
      setOutline(result.outline)
      if (result.lecture) onOutlineSaved?.(result.lecture)
      if (typeof result.creditBalance === 'number') {
        updateUser({ creditBalance: result.creditBalance })
      }
      setChat((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: isFirst
            ? `Đã tạo dàn ý ${result.outline.sections.length} phần. Bạn có thể sửa trực tiếp hoặc nhắn thêm yêu cầu để AI tạo lại.`
            : 'Đã cập nhật dàn ý theo yêu cầu của bạn.'
        }
      ])
    } catch (err) {
      if (controller.signal.aborted) return
      setInput((current) => (current.trim() ? current : text))
      const msg = errorMessage(err, 'Không thể sinh dàn ý, vui lòng thử lại')
      setChat((prev) => [...prev, { role: 'assistant', text: `⚠️ ${msg}` }])
      showToast(msg, 'error')
    } finally {
      setBusyChat(false)
    }
  }

  const updateSections = (
    fn: (sections: Outline['sections']) => Outline['sections']
  ) =>
    setOutline((prev) =>
      prev ? { ...prev, sections: fn(prev.sections) } : prev
    )

  const updateBullets = (secIdx: number, fn: (b: string[]) => string[]) =>
    updateSections((sections) =>
      sections.map((sec, idx) =>
        idx === secIdx ? { ...sec, bullets: fn(sec.bullets) } : sec
      )
    )

  const swap = <T,>(list: T[], from: number, to: number) => {
    if (to < 0 || to >= list.length) return list
    const next = [...list]
    ;[next[from], next[to]] = [next[to], next[from]]
    return next
  }

  const handleDeleteSection = (secIdx: number) => {
    if (!outline || outline.sections.length <= 1) {
      showToast('Dàn ý cần có ít nhất một phần', 'error')
      return
    }
    updateSections((sections) => sections.filter((_, idx) => idx !== secIdx))
  }

  const handleGenerate = async () => {
    if (!outline) return
    const controller = new AbortController()
    requestRef.current = controller
    setBusyCreate(true)
    try {
      const created = await generationApi.create(
        {
          lectureId: lecture._id,
          title: lecture.title || outline.title || 'Bài giảng mới',
          prompt,
          theme: themeId,
          outline
        },
        controller.signal
      )
      if (typeof created.creditBalance === 'number') {
        updateUser({ creditBalance: created.creditBalance })
      }
      onDone(created)
    } catch (err) {
      if (controller.signal.aborted) return
      showToast(
        errorMessage(err, 'Không thể sinh bài giảng, vui lòng thử lại'),
        'error'
      )
    } finally {
      setBusyCreate(false)
    }
  }

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div className='fixed inset-0 z-50 flex flex-col bg-white font-sans'>
      <div className='flex items-center justify-between border-b border-stone-300 px-8 py-4'>
        <div>
          <span className='text-xs font-bold tracking-widest text-orange-700 uppercase'>
            Tạo bài giảng bằng AI ·{' '}
            {step === 'outline' ? 'Bước 1/2: Dàn ý' : 'Bước 2/2: Thiết kế'}
          </span>
          <h2 className='mt-0.5 text-2xl font-medium text-emerald-950 font-display'>
            {lecture.title}
          </h2>
        </div>
        <button
          type='button'
          disabled={busyChat || busyCreate}
          onClick={onSkip}
          className='border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100 disabled:opacity-50'
        >
          Bỏ qua, dùng canvas trống
        </button>
      </div>

      {step === 'outline' ? (
        <div className='grid flex-1 overflow-hidden md:grid-cols-10 md:divide-x divide-stone-300'>
          {/* Khung Chat AI (Chat first) */}
          <div className='flex flex-col overflow-hidden bg-stone-50 p-6 md:col-span-4'>
            <div className='flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar'>
              <div className='border border-stone-200 bg-white p-3 text-xs text-stone-700'>
                Mô tả bài giảng bạn muốn tạo (chủ đề, đối tượng, số phần...). AI
                sẽ sinh dàn ý để bạn chỉnh sửa trước khi sinh slide.
              </div>
              {chat.map((m, idx) => (
                <div
                  key={idx}
                  className={`max-w-[90%] whitespace-pre-wrap p-3 text-xs ${
                    m.role === 'user'
                      ? 'ml-auto bg-emerald-950 text-white'
                      : 'border border-stone-200 bg-white text-stone-700'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {busyChat && (
                <div className='flex items-center gap-2 text-xs text-stone-500'>
                  <Loader2 size={13} className='animate-spin' /> AI đang xử
                  lý...
                </div>
              )}
            </div>
            <div className='mt-3 border border-stone-300 bg-white p-2'>
              <textarea
                autoFocus
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                placeholder={
                  outline
                    ? 'Nhắn yêu cầu để AI tạo lại dàn ý...'
                    : 'Ví dụ: Căn bản về NodeJS cho sinh viên IT...'
                }
                className='w-full resize-none border-0 p-1 text-xs outline-none'
              />
              <div className='flex justify-end'>
                <button
                  type='button'
                  onClick={() => void handleSend()}
                  disabled={
                    input.trim().length < (!outline || !prompt ? 5 : 1) ||
                    busyChat
                  }
                  className='flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-white transition hover:bg-stone-800 disabled:opacity-30'
                  title='Gửi'
                  aria-label='Gửi'
                >
                  <ArrowUp size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>
            <AiDataNotice className='mt-1.5' />
          </div>

          {/* Dàn ý dạng cây có thể tương tác */}
          <div className='flex flex-col overflow-hidden p-6 md:col-span-6'>
            <div className='border-b border-stone-200 pb-3 text-xs font-bold text-emerald-950 uppercase tracking-wider'>
              Dàn ý bài giảng{' '}
              {outline ? `(${outline.sections.length} phần)` : ''}
            </div>
            <div className='my-4 flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar'>
              {!outline && (
                <div className='flex h-full min-h-65 items-center justify-center border border-dashed border-stone-200 p-8 text-center text-xs text-stone-500'>
                  Dàn ý sẽ hiện ở đây sau khi bạn gửi mô tả bài giảng.
                </div>
              )}
              {outline?.sections.map((sec, secIdx) => (
                <div
                  key={secIdx}
                  className='group/sec border border-stone-200 bg-stone-50/50 p-3.5'
                >
                  <div className='flex items-start gap-2'>
                    <span className='mt-1 shrink-0 font-mono text-xs font-bold text-orange-700'>
                      {String(secIdx + 1).padStart(2, '0')}.
                    </span>
                    <textarea
                      rows={1}
                      value={sec.heading}
                      ref={autoGrow}
                      onChange={(e) => {
                        const value = e.target.value
                        updateSections((sections) =>
                          sections.map((s, idx) =>
                            idx === secIdx ? { ...s, heading: value } : s
                          )
                        )
                        autoGrow(e.target)
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                      className='flex-1 resize-none overflow-hidden border-b border-transparent bg-transparent text-sm font-semibold text-emerald-950 font-display outline-hidden focus:border-orange-700 focus:bg-white'
                      placeholder='Nhập tiêu đề phần...'
                    />
                    <button
                      type='button'
                      disabled={secIdx === 0}
                      onClick={() =>
                        updateSections((s) => swap(s, secIdx, secIdx - 1))
                      }
                      className='p-1 text-stone-400 hover:text-orange-700 disabled:opacity-30'
                      aria-label='Di chuyển phần lên'
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type='button'
                      disabled={secIdx === outline.sections.length - 1}
                      onClick={() =>
                        updateSections((s) => swap(s, secIdx, secIdx + 1))
                      }
                      className='p-1 text-stone-400 hover:text-orange-700 disabled:opacity-30'
                      aria-label='Di chuyển phần xuống'
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type='button'
                      onClick={() => handleDeleteSection(secIdx)}
                      className='p-1 text-xs text-stone-400 hover:text-red-700'
                      aria-label='Xóa phần này'
                    >
                      🗑️
                    </button>
                  </div>
                  <div className='mt-2.5 space-y-1.5 pl-6'>
                    {sec.bullets.map((b, bIdx) => (
                      <div
                        key={bIdx}
                        className='group/bullet flex items-start gap-1'
                      >
                        <span className='mt-1 shrink-0 text-xs text-stone-400'>
                          •
                        </span>
                        <textarea
                          rows={1}
                          value={b}
                          ref={autoGrow}
                          onChange={(e) => {
                            const value = e.target.value
                            updateBullets(secIdx, (bullets) =>
                              bullets.map((x, i) => (i === bIdx ? value : x))
                            )
                            autoGrow(e.target)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              updateBullets(secIdx, (bullets) => [
                                ...bullets,
                                ''
                              ])
                            }
                          }}
                          className='flex-1 resize-none overflow-hidden border-b border-transparent bg-transparent text-xs text-stone-700 outline-hidden focus:border-orange-700 focus:bg-white'
                          placeholder='Nhập nội dung ý chính...'
                        />
                        <button
                          type='button'
                          disabled={bIdx === 0}
                          onClick={() =>
                            updateBullets(secIdx, (x) =>
                              swap(x, bIdx, bIdx - 1)
                            )
                          }
                          className='p-0.5 text-stone-300 hover:text-orange-700 disabled:opacity-30'
                          aria-label='Di chuyển ý lên'
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type='button'
                          disabled={bIdx === sec.bullets.length - 1}
                          onClick={() =>
                            updateBullets(secIdx, (x) =>
                              swap(x, bIdx, bIdx + 1)
                            )
                          }
                          className='p-0.5 text-stone-300 hover:text-orange-700 disabled:opacity-30'
                          aria-label='Di chuyển ý xuống'
                        >
                          <ChevronDown size={12} />
                        </button>
                        <button
                          type='button'
                          onClick={() =>
                            updateBullets(secIdx, (x) =>
                              x.filter((_, i) => i !== bIdx)
                            )
                          }
                          className='px-1 text-xs text-stone-300 hover:text-red-600'
                          aria-label='Xóa ý này'
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type='button'
                      onClick={() => updateBullets(secIdx, (x) => [...x, ''])}
                      className='mt-1 text-[11px] font-semibold text-orange-700 hover:text-orange-900'
                    >
                      + Thêm ý
                    </button>
                  </div>
                </div>
              ))}
              {outline && (
                <button
                  type='button'
                  onClick={() =>
                    updateSections((sections) => [
                      ...sections,
                      { heading: `Phần ${sections.length + 1}`, bullets: [''] }
                    ])
                  }
                  className='w-full border border-dashed border-stone-300 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-100'
                >
                  + Thêm phần mới
                </button>
              )}
            </div>
            <div className='flex justify-end border-t border-stone-200 pt-4'>
              <button
                type='button'
                disabled={!outline || busyChat}
                onClick={() => setStep('pattern')}
                className='bg-emerald-950 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-stone-900 disabled:opacity-40'
              >
                Tiếp tục
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className='flex flex-1 flex-col overflow-hidden p-6'>
          <div className='grid flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-2 lg:grid-cols-3'>
            {THEME_PRESETS.map((t) => {
              const selected = themeId === t.id
              return (
                <button
                  key={t.id}
                  type='button'
                  onClick={() => setThemeId(t.id)}
                  aria-pressed={selected}
                  className={`flex flex-col border p-3 text-left transition ${
                    selected
                      ? 'border-orange-700 ring-2 ring-orange-700/20'
                      : 'border-stone-200 hover:border-stone-400'
                  }`}
                >
                  {/* Xem trước một slide mẫu theo pattern */}
                  <div
                    className='aspect-video w-full p-4'
                    style={{ backgroundColor: t.background }}
                  >
                    <div
                      className='mb-2 h-1 w-10'
                      style={{ backgroundColor: t.accentColor }}
                    />
                    <div
                      className='text-base font-bold'
                      style={{
                        color: t.textPrimary,
                        fontFamily: FONT_MAP[t.headingFont]
                      }}
                    >
                      {outline?.sections[0]?.heading || lecture.title}
                    </div>
                    <div
                      className='mt-2 border p-2 text-[10px]'
                      style={{
                        color: t.textSecondary,
                        backgroundColor: t.cardBackground,
                        borderColor: t.cardBorder,
                        fontFamily: FONT_MAP[t.bodyFont]
                      }}
                    >
                      {outline?.sections[0]?.bullets[0] || 'Nội dung ý chính'}
                    </div>
                  </div>
                  <div className='mt-2 text-xs font-bold text-stone-900'>
                    {t.name} {selected && '✓'}
                  </div>
                  <dl className='mt-1 space-y-0.5 text-[11px] text-stone-600'>
                    <div>
                      <dt className='inline font-semibold'>Font chữ: </dt>
                      <dd className='inline'>
                        {fontName(t.headingFont)} / {fontName(t.bodyFont)}
                      </dd>
                    </div>
                    <div>
                      <dt className='inline font-semibold'>Cỡ chữ: </dt>
                      <dd className='inline'>
                        Tiêu đề {TITLE_FONT_SIZE}px · Nội dung {BODY_FONT_SIZE}
                        px
                      </dd>
                    </div>
                    <div className='flex items-center gap-1'>
                      <dt className='inline font-semibold'>Bảng màu: </dt>
                      {[
                        t.background,
                        t.cardBackground,
                        t.textPrimary,
                        t.accentColor
                      ].map((c) => (
                        <dd
                          key={c}
                          className='h-3.5 w-3.5 border border-black/10'
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </dl>
                </button>
              )
            })}
          </div>
          <div className='mt-4 flex justify-between border-t border-stone-200 pt-4'>
            <button
              type='button'
              disabled={busyCreate}
              onClick={() => {
                setThemeId(DEFAULT_THEME_ID)
                setStep('outline')
              }}
              className='border border-stone-300 px-5 py-3 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50'
            >
              Quay lại
            </button>
            <button
              type='button'
              disabled={busyCreate}
              onClick={() => void handleGenerate()}
              className='bg-orange-700 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-orange-800 disabled:opacity-50'
            >
              {busyCreate ? 'Đang sinh bài giảng...' : 'Sinh bài giảng'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
