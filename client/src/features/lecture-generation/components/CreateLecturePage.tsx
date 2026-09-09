import { useState } from 'react'
import { isAxiosError } from 'axios'
import { generationApi } from '@/features/lecture-generation/api/generation.api'
import { lectureApi } from '@/features/library/api/lecture.api'
import { useToast } from '@/components/ui/Toast'
import type { Lecture, Outline } from '@/lib/types'

interface CreateLecturePageProps {
  onDone: (lecture: Lecture) => void
  onBack: () => void
}

export const CreateLecturePage = ({
  onDone,
  onBack
}: CreateLecturePageProps) => {
  const { showToast } = useToast()
  const [title, setTitle] = useState('Bài giảng mới')
  const [prompt, setPrompt] = useState('')
  const [outline, setOutline] = useState<Outline | null>(null)
  const [pattern, setPattern] = useState('default')
  const [busy, setBusy] = useState(false)
  const generate = async () => {
    setBusy(true)
    try {
      const result = await generationApi.outline(prompt)
      setOutline(result.outline)
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message ||
          'Không sinh được outline'
        : 'Không sinh được outline'
      showToast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }
  const create = async () => {
    if (!outline) return
    setBusy(true)
    try {
      onDone(await generationApi.create({ title, prompt, pattern, outline }))
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message ||
          'Không tạo được bài giảng'
        : 'Không tạo được bài giảng'
      showToast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }
  const blank = async () => {
    try {
      onDone(await lectureApi.createBlank(title))
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message ||
          'Không tạo được canvas'
        : 'Không tạo được canvas'
      showToast(msg, 'error')
    }
  }
  return (
    <main className='mx-auto max-w-6xl px-5 py-12 sm:px-12'>
      <button
        className='mb-8 font-sans text-sm font-semibold text-orange-700'
        onClick={onBack}
      >
        ← Thư viện
      </button>
      <div className='mb-9'>
        <span className='font-sans text-xs font-bold tracking-widest text-orange-700'>
          NEW LESSON
        </span>
        <h1 className='mt-2 text-6xl font-medium leading-none text-emerald-950'>
          Tạo bài giảng
        </h1>
        <p className='mt-3 font-sans text-sm text-stone-500'>
          Bắt đầu bằng một câu hỏi, chủ đề hoặc mục tiêu học tập.
        </p>
      </div>
      <div className='grid gap-5 lg:grid-cols-2'>
        <div className='border border-stone-300 bg-stone-50 p-7'>
          <label className='block font-sans text-sm font-semibold text-stone-600'>
            Tên bài giảng
            <input
              className='mt-2 w-full border border-stone-300 bg-white p-3 outline-orange-700'
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className='mt-6 block font-sans text-sm font-semibold text-stone-600'>
            Prompt cho AI
            <textarea
              className='mt-2 w-full border border-stone-300 bg-white p-3 outline-orange-700'
              rows={7}
              placeholder='Ví dụ: Giải thích chu trình nước cho học sinh lớp 6...'
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>
          <div className='mt-5 flex gap-2'>
            <button
              className='bg-orange-700 px-4 py-3 font-sans text-sm font-bold text-white disabled:opacity-50'
              disabled={busy || prompt.length < 5}
              onClick={() => void generate()}
            >
              {busy ? 'Đang tạo...' : 'Sinh outline'}
            </button>
            <button
              className='border border-stone-400 px-4 py-3 font-sans text-sm font-semibold'
              onClick={() => void blank()}
            >
              Canvas trống
            </button>
          </div>
        </div>
        <div className='min-h-112.5 border border-stone-300 bg-stone-50 p-7'>
          <span className='font-sans text-xs font-bold tracking-widest text-orange-700'>
            OUTLINE
          </span>
          {outline ? (
            <>
              <h2 className='mt-4 text-3xl font-medium'>{outline.title}</h2>
              {outline.sections.map((section, index) => (
                <div
                  className='border-b border-stone-200 py-4 font-sans text-sm'
                  key={`${section.heading}-${index}`}
                >
                  <b>
                    {index + 1}. {section.heading}
                  </b>
                  <ul className='mt-2 list-disc pl-5 text-stone-500'>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <label className='mt-5 block font-sans text-sm font-semibold text-stone-600'>
                Pattern
                <select
                  className='mt-2 w-full border border-stone-300 bg-white p-3'
                  value={pattern}
                  onChange={(event) => setPattern(event.target.value)}
                >
                  <option value='default'>Editorial Green</option>
                  <option value='warm'>Warm Classroom</option>
                  <option value='mono'>Monochrome</option>
                </select>
              </label>
              <button
                className='mt-5 w-full bg-orange-700 px-4 py-3 font-sans text-sm font-bold text-white'
                onClick={() => void create()}
              >
                Sinh bài giảng
              </button>
            </>
          ) : (
            <p className='mt-32 text-center font-sans text-sm text-stone-400'>
              Outline sẽ xuất hiện tại đây.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
