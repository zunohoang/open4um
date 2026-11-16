import { useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpToLine, Crop, ImageUp } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import type { ImageCrop, SlideComponent } from '@/lib/types'
import { IMAGE_ACCEPT, useImageUploader } from '../hooks/useImageUploader'

const btn =
  'flex h-7 items-center gap-1 rounded-md border border-stone-200 px-1.5 text-xs font-bold text-stone-700 transition hover:bg-stone-100 disabled:opacity-50'

// SRS UC011: "Thay ảnh" dùng chung luồng upload (kiểm tra tệp, Thử lại khi lỗi)
export const ImageReplaceButton = ({
  onReplaced
}: {
  onReplaced: (url: string) => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload, isUploading, failedFile, retry } =
    useImageUploader(onReplaced)

  return (
    <>
      <input
        ref={inputRef}
        type='file'
        accept={IMAGE_ACCEPT}
        className='hidden'
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void upload(file)
        }}
      />
      <button
        type='button'
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className={btn}
        title='Thay ảnh khác'
      >
        <ImageUp size={12} />
        <span>{isUploading ? 'Đang tải...' : 'Thay ảnh'}</span>
      </button>
      {failedFile && (
        <button
          type='button'
          onClick={retry}
          className='text-[11px] font-bold text-red-700 underline'
        >
          Thử lại
        </button>
      )}
    </>
  )
}

const NO_CROP: ImageCrop = { top: 0, right: 0, bottom: 0, left: 0 }
const CROP_SIDES: Array<[keyof ImageCrop, string]> = [
  ['top', 'Trên'],
  ['bottom', 'Dưới'],
  ['left', 'Trái'],
  ['right', 'Phải']
]

// SRS UC011 10a-10c: chọn vùng crop trên ảnh gốc, Áp dụng hoặc Hủy
export const ImageCropButton = ({
  component,
  onApply
}: {
  component: SlideComponent
  onApply: (crop: ImageCrop | undefined) => void
}) => {
  const [draft, setDraft] = useState<ImageCrop | null>(null)
  const src = component.imageUrl || component.content

  const apply = () => {
    if (!draft) return
    const isEmpty = Object.values(draft).every((v) => v === 0)
    onApply(isEmpty ? undefined : draft)
    setDraft(null)
  }

  return (
    <>
      <button
        type='button'
        onClick={() => setDraft(component.crop ?? NO_CROP)}
        className={btn}
        title='Cắt ảnh'
      >
        <Crop size={12} />
        <span>Cắt</span>
      </button>
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title='Cắt ảnh'
      >
        {draft && (
          <div className='font-sans'>
            <div className='relative overflow-hidden bg-stone-100'>
              <img src={src} alt='Ảnh gốc' className='block w-full' />
              <div
                className='pointer-events-none absolute border-2 border-white'
                style={{
                  top: `${draft.top}%`,
                  right: `${draft.right}%`,
                  bottom: `${draft.bottom}%`,
                  left: `${draft.left}%`,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)'
                }}
              />
            </div>
            <div className='mt-4 grid grid-cols-2 gap-3'>
              {CROP_SIDES.map(([side, label]) => (
                <label key={side} className='text-xs text-stone-600'>
                  {label}: {draft[side]}%
                  <input
                    type='range'
                    min={0}
                    max={45}
                    value={draft[side]}
                    onChange={(e) =>
                      setDraft({ ...draft, [side]: Number(e.target.value) })
                    }
                    className='w-full accent-orange-700'
                  />
                </label>
              ))}
            </div>
            <div className='mt-5 flex justify-end gap-2'>
              <button
                type='button'
                onClick={() => setDraft(null)}
                className='border border-stone-300 px-4 py-2 text-xs font-semibold hover:bg-stone-100'
              >
                Hủy
              </button>
              <button
                type='button'
                onClick={apply}
                className='bg-orange-700 px-4 py-2 text-xs font-bold text-white hover:bg-orange-800'
              >
                Áp dụng
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

// SRS UC012 bước 3: thay đổi thứ tự lớp
export const LayerOrderButtons = ({
  onChange
}: {
  onChange: (direction: 'up' | 'down') => void
}) => (
  <>
    <button
      type='button'
      onClick={() => onChange('up')}
      className='flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100'
      title='Đưa lên một lớp'
      aria-label='Đưa lên một lớp'
    >
      <ArrowUpToLine size={13} />
    </button>
    <button
      type='button'
      onClick={() => onChange('down')}
      className='flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100'
      title='Đưa xuống một lớp'
      aria-label='Đưa xuống một lớp'
    >
      <ArrowDownToLine size={13} />
    </button>
  </>
)
