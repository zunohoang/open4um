import { useState } from 'react'
import { isAxiosError } from 'axios'
import { generationApi } from '@/features/lecture-generation/api/generation.api'
import { lectureApi } from '@/features/library/api/lecture.api'
import { useToast } from '@/components/ui/Toast'
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
  const [title, setTitle] = useState('Bài giảng mới')
  const [prompt, setPrompt] = useState('')
  const [outline, setOutline] = useState<Outline | null>(null)
  const [pattern, setPattern] = useState('default')
  const [busyOutline, setBusyOutline] = useState(false)
  const [busyCreate, setBusyCreate] = useState(false)
  const busy = busyOutline || busyCreate

  if (!open) return null

  const handleGenerateOutline = async () => {
    if (!prompt.trim()) return
    setBusyOutline(true)
    try {
      const result = await generationApi.outline(prompt)
      setOutline(result.outline)
      // Tự điền tiêu đề bài giảng từ AI nếu user chưa đổi (vẫn để mặc định)
      if (title === 'Bài giảng mới' && result.outline.title) {
        setTitle(result.outline.title)
      }
    } catch (err) {
      let msg = 'Không thể sinh outline từ prompt, vui lòng thử lại'
      if (isAxiosError(err)) {
        const status = err.response?.status
        const serverMsg = (err.response?.data as { message?: string })?.message
        if (status === 402) {
          msg = serverMsg || 'Không đủ credit để thực hiện thao tác này'
        } else if (status === 422) {
          msg =
            serverMsg ||
            'AI không sinh được outline từ prompt này, vui lòng thử lại với chủ đề rõ ràng hơn'
        } else {
          msg = serverMsg || msg
        }
      }
      showToast(msg, 'error')
    } finally {
      setBusyOutline(false)
    }
  }

  const handleCreateLecture = async () => {
    if (!outline) return
    setBusyCreate(true)
    try {
      const created = await generationApi.create({
        title: title.trim() || 'Bài giảng mới',
        prompt,
        pattern,
        outline
      })
      onDone(created)
      onClose()
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message ||
          'Không thể tạo bài giảng, vui lòng thử lại'
        : 'Không thể tạo bài giảng, vui lòng thử lại'
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
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message ||
          'Không thể tạo canvas trống, vui lòng thử lại'
        : 'Không thể tạo canvas trống, vui lòng thử lại'
      showToast(msg, 'error')
    } finally {
      setBusyCreate(false)
    }
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs'
      onClick={onClose}
    >
      <div
        className='relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden border border-stone-300 bg-brand-paper shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal phong cách tạp chí cổ điển */}
        <div className='flex items-center justify-between border-b border-stone-300 bg-white px-8 py-5'>
          <div>
            <span className='font-sans text-xs font-bold tracking-widest text-orange-700 uppercase'>
              NEW LESSON
            </span>
            <h2 className='mt-1 text-3xl font-medium text-emerald-950 font-display'>
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

        {/* Nội dung chính: 2 cột theo đúng layout của CreateLecturePage cũ */}
        <div className='grid flex-1 gap-6 overflow-y-auto p-8 lg:grid-cols-2'>
          {/* Cột 1: Thông tin đầu vào */}
          <div className='border border-stone-300 bg-stone-50 p-6 space-y-5 font-sans'>
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
                Prompt cho AI
              </label>
              <textarea
                id='modal-lecture-prompt'
                className='mt-2 w-full border border-stone-300 bg-white p-3 text-xs outline-orange-700 resize-none'
                rows={6}
                placeholder='Ví dụ: Giải thích chu trình tuần hoàn của nước cho học sinh lớp 6...'
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <div className='flex items-center gap-3 pt-2'>
              <button
                type='button'
                disabled={busy || prompt.trim().length < 5}
                onClick={() => void handleGenerateOutline()}
                className='flex-1 bg-orange-700 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-orange-800 disabled:opacity-50'
              >
                {busyOutline ? 'Đang sinh outline...' : 'Sinh outline'}
              </button>

              <button
                type='button'
                disabled={busy}
                onClick={() => void handleCreateBlank()}
                className='border border-stone-400 bg-white px-4 py-3 text-xs font-semibold text-stone-700 transition hover:bg-stone-100'
              >
                Canvas trống
              </button>
            </div>
          </div>

          {/* Cột 2: Xem trước Dàn ý & Tùy chọn giao diện */}
          <div className='flex flex-col justify-between border border-stone-300 bg-stone-50 p-6 font-sans'>
            {outline ? (
              <div className='flex flex-col justify-between h-full space-y-4'>
                <div>
                  <div className='flex items-center justify-between border-b border-stone-200 pb-2.5'>
                    <span className='text-xs font-bold text-emerald-950 uppercase tracking-wider'>
                      Dàn ý đề xuất ({outline.sections.length} slide)
                    </span>
                    <span className='text-xs font-bold text-orange-700'>
                      {outline.title}
                    </span>
                  </div>

                  <div className='mt-3 max-h-56 space-y-2.5 overflow-y-auto pr-1 text-xs'>
                    {outline.sections.map((sec, idx) => (
                      <div
                        key={sec.heading + idx}
                        className='border border-stone-200 bg-white p-3'
                      >
                        <strong className='text-emerald-950 font-display text-sm font-medium'>
                          {String(idx + 1).padStart(2, '0')}. {sec.heading}
                        </strong>
                        <ul className='mt-1.5 list-disc pl-4 text-[11px] text-stone-600 space-y-0.5'>
                          {sec.bullets.map((b, bIdx) => (
                            <li key={bIdx}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className='space-y-4 pt-3 border-t border-stone-200'>
                  <div>
                    <label className='block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2'>
                      Phong cách thiết kế
                    </label>
                    <div className='flex gap-2'>
                      {['default', 'warm', 'mono'].map((item) => (
                        <button
                          key={item}
                          type='button'
                          onClick={() => setPattern(item)}
                          className={`border px-3.5 py-2 text-xs font-sans uppercase transition ${
                            pattern === item
                              ? 'border-orange-700 bg-orange-100 font-bold text-orange-900'
                              : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type='button'
                    disabled={busy}
                    onClick={() => void handleCreateLecture()}
                    className='w-full bg-emerald-950 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-stone-900 disabled:opacity-60'
                  >
                    {busyCreate
                      ? 'Đang tạo bài giảng...'
                      : `Tạo bài giảng ngay (${outline.sections.length} slide)`}
                  </button>
                </div>
              </div>
            ) : (
              <div className='flex h-full flex-col items-center justify-center text-center p-6'>
                <div className='mb-3 text-3xl opacity-80'>🪄</div>
                <h4 className='text-sm font-bold text-emerald-950 uppercase tracking-wider'>
                  Xem trước cấu trúc bài giảng
                </h4>
                <p className='mt-2 max-w-xs text-xs text-stone-500 leading-relaxed'>
                  Nhập chủ đề vào ô bên trái và bấm &quot;Sinh outline&quot;. AI
                  sẽ tự động tạo dàn ý bài giảng chi tiết.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
