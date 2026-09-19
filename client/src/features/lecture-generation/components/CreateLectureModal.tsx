import { useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { generationApi } from '@/features/lecture-generation/api/generation.api'
import { lectureApi } from '@/features/library/api/lecture.api'
import { useToast } from '@/components/ui/Toast'
import { useAuthStore } from '@/features/auth/store/auth.store'
import type { Lecture, Outline } from '@/lib/types'

interface CreateLectureModalProps {
  open: boolean
  onClose: () => void
  onDone: (lecture: Lecture) => void
}

export const CreateLectureModal = ({
  open,
  onClose,
  onDone
}: CreateLectureModalProps) => {
  const { showToast } = useToast()
  const updateUser = useAuthStore((state) => state.updateUser)
  const overlayRef = useRef<HTMLDivElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)

  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [outline, setOutline] = useState<Outline | null>(null)
  const [lectureId, setLectureId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [busyOutline, setBusyOutline] = useState(false)
  const [busyRefine, setBusyRefine] = useState(false)
  const [busyCreate, setBusyCreate] = useState(false)

  const busy = busyOutline || busyRefine || busyCreate

  if (!open) return null

  const handleGenerateOutline = async () => {
    if (!prompt.trim()) return
    setBusyOutline(true)
    try {
      const result = await generationApi.outline(prompt)
      setOutline(result.outline)
      if (result.lecture?._id) {
        setLectureId(result.lecture._id)
      }
      if (typeof result.creditBalance === 'number') {
        updateUser({ creditBalance: result.creditBalance })
      }
      // Tự điền tiêu đề bài giảng từ AI nếu user chưa đặt
      if (!title.trim() && result.outline.title) {
        setTitle(result.outline.title)
      }
    } catch (err) {
      const msg =
        (isAxiosError(err) &&
          (err.response?.data as { message?: string })?.message) ||
        'Không thể sinh dàn ý từ prompt, vui lòng thử lại'
      showToast(msg, 'error')
    } finally {
      setBusyOutline(false)
    }
  }

  const handleRefineOutline = async () => {
    if (!feedback.trim() || !outline) return
    setBusyRefine(true)
    try {
      const result = await generationApi.outline(prompt, {
        feedback: feedback.trim(),
        currentOutline: outline,
        lectureId: lectureId ?? undefined
      })
      setOutline(result.outline)
      if (result.lecture?._id) {
        setLectureId(result.lecture._id)
      }
      if (typeof result.creditBalance === 'number') {
        updateUser({ creditBalance: result.creditBalance })
      }
      if (!title.trim() && result.outline.title) {
        setTitle(result.outline.title)
      }
      showToast('AI đã điều chỉnh dàn ý thành công!', 'success')
      setFeedback('')
    } catch (err) {
      const msg =
        (isAxiosError(err) &&
          (err.response?.data as { message?: string })?.message) ||
        'Không thể điều chỉnh dàn ý, vui lòng thử lại'
      showToast(msg, 'error')
    } finally {
      setBusyRefine(false)
    }
  }

  const handleUpdateHeading = (secIdx: number, val: string) => {
    setOutline((prev) => {
      if (!prev) return prev
      const sections = prev.sections.map((sec, idx) =>
        idx === secIdx ? { ...sec, heading: val } : sec
      )
      return { ...prev, sections }
    })
  }

  const handleUpdateBullet = (
    secIdx: number,
    bulletIdx: number,
    val: string
  ) => {
    setOutline((prev) => {
      if (!prev) return prev
      const sections = prev.sections.map((sec, idx) => {
        if (idx !== secIdx) return sec
        const bullets = sec.bullets.map((b, bIdx) =>
          bIdx === bulletIdx ? val : b
        )
        return { ...sec, bullets }
      })
      return { ...prev, sections }
    })
  }

  const handleAddBullet = (secIdx: number) => {
    setOutline((prev) => {
      if (!prev) return prev
      const sections = prev.sections.map((sec, idx) => {
        if (idx !== secIdx) return sec
        return { ...sec, bullets: [...sec.bullets, ''] }
      })
      return { ...prev, sections }
    })
  }

  const handleDeleteBullet = (secIdx: number, bulletIdx: number) => {
    setOutline((prev) => {
      if (!prev) return prev
      const sections = prev.sections.map((sec, idx) => {
        if (idx !== secIdx) return sec
        return {
          ...sec,
          bullets: sec.bullets.filter((_, bIdx) => bIdx !== bulletIdx)
        }
      })
      return { ...prev, sections }
    })
  }

  const handleDeleteSection = (secIdx: number) => {
    setOutline((prev) => {
      if (!prev) return prev
      if (prev.sections.length <= 1) {
        showToast('Dàn ý cần có ít nhất một phần', 'error')
        return prev
      }
      return {
        ...prev,
        sections: prev.sections.filter((_, idx) => idx !== secIdx)
      }
    })
  }

  const handleAddSection = () => {
    setOutline((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        sections: [
          ...prev.sections,
          { heading: `Phần ${prev.sections.length + 1}`, bullets: [''] }
        ]
      }
    })
  }

  const handleCreateLecture = async () => {
    if (!outline) return
    setBusyCreate(true)
    try {
      const created = await generationApi.create({
        lectureId: lectureId ?? undefined,
        title: title.trim() || 'Bài giảng mới',
        prompt,
        outline
      })
      if (typeof created.creditBalance === 'number') {
        updateUser({ creditBalance: created.creditBalance })
      }
      onDone(created)
      onClose()
    } catch (err) {
      const msg =
        (isAxiosError(err) &&
          (err.response?.data as { message?: string })?.message) ||
        'Không thể tạo bài giảng, vui lòng thử lại'
      showToast(msg, 'error')
    } finally {
      setBusyCreate(false)
    }
  }

  const handleCreateBlank = async () => {
    setBusyCreate(true)
    try {
      const created = await lectureApi.createBlank(
        title.trim() || 'Bài giảng mới'
      )
      onDone(created)
      onClose()
    } catch (err) {
      const msg =
        (isAxiosError(err) &&
          (err.response?.data as { message?: string })?.message) ||
        'Không thể tạo canvas trống, vui lòng thử lại'
      showToast(msg, 'error')
    } finally {
      setBusyCreate(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      className='fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs'
      onMouseDown={(e) => {
        mouseDownTargetRef.current = e.target
      }}
      onClick={(e) => {
        if (
          e.target === overlayRef.current &&
          mouseDownTargetRef.current === overlayRef.current
        ) {
          onClose()
        }
      }}
    >
      <div
        className='relative flex max-h-[92vh] h-[86vh] w-full max-w-5xl flex-col overflow-hidden border border-stone-300 bg-white shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className='flex items-center justify-between border-b border-stone-300 bg-white px-8 py-4'>
          <div>
            <span className='font-sans text-xs font-bold tracking-widest text-orange-700 uppercase'>
              NEW LESSON
            </span>
            <h2 className='mt-0.5 text-2xl sm:text-3xl font-medium text-emerald-950 font-display'>
              Tạo bài giảng
            </h2>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='p-2 font-sans text-xl text-stone-400 transition hover:text-emerald-950'
            aria-label='Đóng'
          >
            ✕
          </button>
        </div>

        {/* Nội dung chính: 2 box chia theo CSS Grid tỉ lệ 3/7 */}
        <div className='grid flex-1 overflow-hidden md:grid-cols-10 md:divide-x divide-stone-300'>
          {/* Cột 1 (3/10 chiều rộng): Thông tin đầu vào */}
          <div className='flex flex-col justify-between bg-stone-50 p-6 md:col-span-3'>
            <div className='space-y-4'>
              <div>
                <label
                  htmlFor='modal-lecture-title'
                  className='block text-xs font-bold text-stone-700 uppercase tracking-wider'
                >
                  Tên bài giảng
                </label>
                <input
                  id='modal-lecture-title'
                  className='mt-2 w-full border border-stone-300 bg-white p-3 text-xs outline-orange-700'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder='Nhập tên bài giảng...'
                />
              </div>

              <div>
                <label
                  htmlFor='modal-lecture-prompt'
                  className='block text-xs font-bold text-stone-700 uppercase tracking-wider'
                >
                  Prompt sinh dàn ý
                </label>
                <textarea
                  id='modal-lecture-prompt'
                  className='mt-2 w-full border border-stone-300 bg-white p-3 text-xs outline-orange-700 resize-none custom-scrollbar'
                  rows={8}
                  placeholder='Ví dụ: Căn bản về NodeJS cho sinh viên IT...'
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

              {/* Nút Sinh outline nằm riêng ở trên */}
              <button
                type='button'
                disabled={busy || prompt.trim().length < 5}
                onClick={() => void handleGenerateOutline()}
                className='w-full bg-orange-700 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-orange-800 disabled:opacity-50'
              >
                {busyOutline ? 'Đang sinh outline...' : 'Sinh outline'}
              </button>
            </div>
          </div>

          {/* Cột 2 (7/10 chiều rộng): Xem trước & Chỉnh sửa Dàn ý */}
          <div className='flex flex-col justify-between bg-white p-6 overflow-hidden md:col-span-7'>
            {/* Header dàn ý */}
            <div className='flex items-center justify-between border-b border-stone-200 pb-3'>
              <span className='text-xs font-bold text-emerald-950 uppercase tracking-wider'>
                Dàn ý bài giảng{' '}
                {outline ? `(${outline.sections.length} phần)` : ''}
              </span>
              {outline && (
                <span className='text-[11px] text-stone-400'>
                  Bạn có thể nhấp chuột trực tiếp để chỉnh sửa tiêu đề và các ý
                </span>
              )}
            </div>

            {/* Danh sách các phần có thể chỉnh sửa thủ công & Nhờ AI sửa */}
            <div className='my-4 flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4'>
              {outline ? (
                <>
                  <div className='space-y-3'>
                    {outline.sections.map((sec, secIdx) => {
                      return (
                        <div
                          key={secIdx}
                          className='group/sec border border-stone-200 bg-stone-50/50 p-3.5 transition hover:border-stone-300 hover:bg-stone-50/80'
                        >
                          {/* Dòng tiêu đề phần */}
                          <div className='flex items-center gap-2'>
                            <span className='font-mono text-xs font-bold text-orange-700 shrink-0'>
                              {String(secIdx + 1).padStart(2, '0')}.
                            </span>
                            <input
                              type='text'
                              value={sec.heading}
                              onChange={(e) =>
                                handleUpdateHeading(secIdx, e.target.value)
                              }
                              className='flex-1 border-b border-transparent bg-transparent text-sm font-semibold text-emerald-950 font-display transition hover:border-stone-300 focus:border-orange-700 focus:bg-white focus:px-2 focus:py-1 outline-hidden'
                              placeholder='Nhập tiêu đề phần...'
                            />
                            <button
                              type='button'
                              onClick={() => handleDeleteSection(secIdx)}
                              className='opacity-0 group-hover/sec:opacity-100 text-stone-400 hover:text-red-700 p-1 text-xs transition'
                              title='Xóa phần này'
                            >
                              🗑️
                            </button>
                          </div>

                          {/* Danh sách các ý chính (bullets) */}
                          <div className='mt-2.5 space-y-1.5 pl-6'>
                            {sec.bullets.map((b, bIdx) => (
                              <div
                                key={bIdx}
                                className='group/bullet flex items-center gap-2'
                              >
                                <span className='text-stone-400 text-xs shrink-0 select-none'>
                                  •
                                </span>
                                <input
                                  type='text'
                                  value={b}
                                  onChange={(e) =>
                                    handleUpdateBullet(
                                      secIdx,
                                      bIdx,
                                      e.target.value
                                    )
                                  }
                                  className='flex-1 border-b border-transparent bg-transparent text-xs text-stone-700 transition hover:border-stone-300 focus:border-orange-700 focus:bg-white focus:px-2 focus:py-0.5 outline-hidden'
                                  placeholder='Nhập nội dung ý chính...'
                                />
                                <button
                                  type='button'
                                  onClick={() =>
                                    handleDeleteBullet(secIdx, bIdx)
                                  }
                                  className='opacity-0 group-hover/bullet:opacity-100 text-stone-300 hover:text-red-600 px-1 text-xs transition'
                                  title='Xóa ý này'
                                >
                                  ✕
                                </button>
                              </div>
                            ))}

                            {/* Nút thêm ý */}
                            <button
                              type='button'
                              onClick={() => handleAddBullet(secIdx)}
                              className='mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 hover:text-orange-900 transition'
                            >
                              + Thêm ý
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {/* Nút thêm phần mới */}
                    <button
                      type='button'
                      onClick={handleAddSection}
                      className='w-full border border-dashed border-stone-300 bg-stone-50/70 py-2.5 text-xs font-semibold text-stone-600 transition hover:border-stone-400 hover:bg-stone-100 hover:text-emerald-950'
                    >
                      + Thêm phần mới
                    </button>
                  </div>

                  {/* KHỐI NHỜ AI ĐIỀU CHỈNH DÀN Ý */}
                  <div className='border border-orange-200 bg-orange-50/40 p-4 space-y-3'>
                    <div className='flex items-center justify-between'>
                      <span className='text-xs font-bold uppercase tracking-wider text-orange-900 flex items-center gap-1.5'>
                        <span>✨</span>
                        <span>Nhờ AI điều chỉnh dàn ý</span>
                      </span>
                      <span className='text-[10px] text-stone-400 font-sans'>
                        Gửi ý kiến đóng góp kèm prompt ban đầu
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder='Ví dụ: Bổ sung phần thực hành với MongoDB, giảm bớt lý thuyết tổng quan...'
                      className='w-full border border-stone-300 bg-white p-2.5 text-xs outline-orange-700 resize-none custom-scrollbar'
                    />
                    <div className='flex justify-end'>
                      <button
                        type='button'
                        disabled={busy || !feedback.trim() || busyRefine}
                        onClick={() => void handleRefineOutline()}
                        className='bg-orange-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-orange-800 disabled:opacity-40 disabled:cursor-not-allowed'
                      >
                        {busyRefine
                          ? 'AI đang điều chỉnh...'
                          : 'Cập nhật dàn ý bằng AI'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className='flex h-full min-h-65 flex-col items-center justify-center text-center p-8 border border-dashed border-stone-200 bg-stone-50/40'>
                  <div className='mb-3 text-3xl opacity-70'>🪄</div>
                  <h4 className='text-sm font-bold text-emerald-950 uppercase tracking-wider'>
                    Xem trước cấu trúc bài giảng
                  </h4>
                  <p className='mt-2 max-w-sm text-xs text-stone-500 leading-relaxed'>
                    Nhập chủ đề vào ô bên trái và bấm &quot;Sinh outline&quot;.
                    AI sẽ tự động phân tích và tạo dàn ý bài giảng chi tiết tại
                    đây. Bạn có thể tự chỉnh sửa hoặc nhờ AI điều chỉnh trước
                    khi tạo slide.
                  </p>
                </div>
              )}
            </div>

            {/* Line cuối 2 nút: Tạo canvas trống và Tạo bài giảng */}
            <div className='flex items-center justify-end gap-3 border-t border-stone-200 pt-4'>
              <button
                type='button'
                disabled={busy}
                onClick={() => void handleCreateBlank()}
                className='border border-stone-300 bg-white px-5 py-3 text-xs font-semibold text-stone-700 transition hover:bg-stone-100 disabled:opacity-50'
              >
                Tạo canvas trống
              </button>

              <button
                type='button'
                disabled={busy || !outline}
                onClick={() => void handleCreateLecture()}
                className='bg-emerald-950 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-stone-900 disabled:opacity-40 disabled:cursor-not-allowed'
              >
                {busyCreate ? 'Đang tạo bài giảng...' : 'Tạo bài giảng'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
