import { useRef, useState } from 'react'
import { useEditorStore } from '../store/editor.store'
import { useToast } from '@/components/ui/Toast'
import type { Outline, Slide } from '@/lib/types'

interface LeftSidebarRailProps {
  onAddTextComponent: (
    type: 'title' | 'subtitle' | 'text' | 'bullets' | 'quote'
  ) => void
  onAddImageComponent: (imageUrl: string) => void
  onApplyTemplate: (layout: Slide['layout']) => void
  outline?: Outline | null
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml'
]

export const LeftSidebarRail = ({
  onAddTextComponent,
  onAddImageComponent,
  onApplyTemplate,
  outline
}: LeftSidebarRailProps) => {
  const { showToast } = useToast()
  const {
    leftRailTab,
    setLeftRailTab,
    isDrawerOpen,
    uploadedImages,
    addUploadedImage,
    removeUploadedImage
  } = useEditorStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Xử lý tải ảnh lên từ máy tính theo Use-case Quản lý hình ảnh
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 1. Kiểm tra định dạng hợp lệ
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      showToast(
        'Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPG, PNG, WEBP, GIF hoặc SVG.',
        'error'
      )
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // 2. Kiểm tra dung lượng hợp lệ (<= 5MB)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      showToast(
        `Kích thước ảnh (${(file.size / (1024 * 1024)).toFixed(1)}MB) vượt quá giới hạn 5MB cho phép.`,
        'error'
      )
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // 3. Đọc dữ liệu ảnh và thêm vào thư viện + chèn vào slide
    setIsUploading(true)
    const reader = new FileReader()

    reader.onload = () => {
      setIsUploading(false)
      const dataUrl = reader.result as string

      // Thêm vào danh sách ảnh đã tải trong store
      addUploadedImage({
        url: dataUrl,
        name: file.name,
        size: file.size
      })

      // Tự động tạo đối tượng ảnh và chèn vào slide
      onAddImageComponent(dataUrl)
      showToast('Tải ảnh lên và chèn vào slide thành công!', 'success')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }

    reader.onerror = () => {
      setIsUploading(false)
      showToast('Có lỗi xảy ra khi đọc tệp ảnh. Vui lòng thử lại.', 'error')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }

    reader.readAsDataURL(file)
  }

  return (
    <div className='flex h-full select-none'>
      {/* 1. THANH ICON RAIL HẸP BÊN TRÁI (CANVA SLIM RAIL) */}
      <nav className='flex w-18 shrink-0 flex-col items-center border-r border-emerald-900/60 bg-brand-ink py-3 text-stone-300'>
        {/* Tab Văn bản */}
        <button
          type='button'
          onClick={() => setLeftRailTab('text')}
          className={`group flex w-15 flex-col items-center justify-center rounded-lg py-2.5 transition ${
            leftRailTab === 'text' && isDrawerOpen
              ? 'border-l-2 border-brand-rust bg-emerald-900/80 font-bold text-brand-rust'
              : 'hover:bg-emerald-900/40 hover:text-white'
          }`}
          title='Chèn văn bản'
        >
          <span className='text-lg'>🔤</span>
          <span className='mt-1 text-[10px] font-medium'>Văn bản</span>
        </button>

        {/* Tab Tải lên */}
        <button
          type='button'
          onClick={() => setLeftRailTab('uploads')}
          className={`group mt-2 flex w-15 flex-col items-center justify-center rounded-lg py-2.5 transition ${
            leftRailTab === 'uploads' && isDrawerOpen
              ? 'border-l-2 border-brand-rust bg-emerald-900/80 font-bold text-brand-rust'
              : 'hover:bg-emerald-900/40 hover:text-white'
          }`}
          title='Tải hình ảnh lên'
        >
          <span className='text-lg'>☁️</span>
          <span className='mt-1 text-[10px] font-medium'>Tải lên</span>
        </button>

        {/* Tab Mẫu slide */}
        <button
          type='button'
          onClick={() => setLeftRailTab('templates')}
          className={`group mt-2 flex w-15 flex-col items-center justify-center rounded-lg py-2.5 transition ${
            leftRailTab === 'templates' && isDrawerOpen
              ? 'border-l-2 border-brand-rust bg-emerald-900/80 font-bold text-brand-rust'
              : 'hover:bg-emerald-900/40 hover:text-white'
          }`}
          title='Bố cục mẫu slide'
        >
          <span className='text-lg'>🎨</span>
          <span className='mt-1 text-[10px] font-medium'>Mẫu slide</span>
        </button>

        {/* Tab Dàn ý nếu có */}
        {outline && (
          <button
            type='button'
            onClick={() => setLeftRailTab('templates')}
            className='group mt-auto flex w-15 flex-col items-center justify-center rounded-lg py-2 transition hover:bg-stone-900 hover:text-stone-200'
            title='Xem dàn ý'
          >
            <span className='text-base'>📑</span>
            <span className='mt-1 text-[9px] font-medium'>Dàn ý</span>
          </button>
        )}
      </nav>

      {/* 2. DRAWER MỞ RỘNG BÊN CẠNH RAIL (EXPANDABLE DRAWER) */}
      {isDrawerOpen && (
        <aside className='flex w-72 shrink-0 flex-col border-r border-stone-200 bg-white font-sans text-stone-800 shadow-sm'>
          {/* TAB VĂN BẢN (TEXT) */}
          {leftRailTab === 'text' && (
            <div className='flex flex-1 flex-col overflow-y-auto p-4'>
              <div className='mb-4'>
                <h3 className='text-sm font-bold text-stone-900'>Văn bản</h3>
                <p className='text-xs text-stone-500'>
                  Click để thêm khối văn bản vào slide
                </p>
              </div>

              <div className='space-y-3'>
                {/* Tiêu đề lớn */}
                <button
                  type='button'
                  onClick={() => onAddTextComponent('title')}
                  className='flex w-full items-center justify-between rounded-lg border border-stone-200 bg-stone-50 p-3.5 text-left font-serif text-lg font-bold text-stone-900 transition hover:border-brand-rust hover:bg-brand-rust/5 hover:text-brand-rust shadow-2xs'
                >
                  <span>Thêm tiêu đề lớn</span>
                  <span className='text-[10px] font-mono text-stone-400 font-normal'>
                    H1
                  </span>
                </button>

                {/* Tiêu đề phụ */}
                <button
                  type='button'
                  onClick={() => onAddTextComponent('subtitle')}
                  className='flex w-full items-center justify-between rounded-lg border border-stone-200 bg-stone-50 p-3 text-left font-sans text-sm font-semibold text-stone-700 transition hover:border-brand-rust hover:bg-brand-rust/5 hover:text-brand-rust shadow-2xs'
                >
                  <span>Thêm tiêu đề phụ</span>
                  <span className='text-[10px] font-mono text-stone-400 font-normal'>
                    H2
                  </span>
                </button>

                {/* Đoạn văn bản */}
                <button
                  type='button'
                  onClick={() => onAddTextComponent('text')}
                  className='flex w-full items-center justify-between rounded-lg border border-stone-200 bg-stone-50 p-3 text-left font-sans text-xs text-stone-600 transition hover:border-brand-rust hover:bg-brand-rust/5 hover:text-brand-rust shadow-2xs'
                >
                  <span>Thêm một chút nội dung văn bản</span>
                  <span className='text-[10px] font-mono text-stone-400'>
                    Body
                  </span>
                </button>

                {/* Danh sách ý Bullets */}
                <button
                  type='button'
                  onClick={() => onAddTextComponent('bullets')}
                  className='flex w-full items-center justify-between rounded-lg border border-stone-200 bg-stone-50 p-3 text-left font-sans text-xs text-stone-600 transition hover:border-brand-rust hover:bg-brand-rust/5 hover:text-brand-rust shadow-2xs'
                >
                  <div className='flex items-center gap-2'>
                    <span>•=</span>
                    <span>Danh sách ý (Bullets)</span>
                  </div>
                  <span className='text-[10px] font-mono text-stone-400'>
                    List
                  </span>
                </button>

                {/* Trích dẫn Quote */}
                <button
                  type='button'
                  onClick={() => onAddTextComponent('quote')}
                  className='flex w-full items-center justify-between rounded-lg border border-stone-200 bg-stone-50 p-3 text-left font-serif text-xs italic text-stone-700 transition hover:border-brand-rust hover:bg-brand-rust/5 hover:text-brand-rust shadow-2xs'
                >
                  <span>“ Khung trích dẫn đáng chú ý ”</span>
                  <span className='text-[10px] font-mono text-stone-400 font-normal'>
                    Quote
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB TẢI LÊN (UPLOADS) */}
          {leftRailTab === 'uploads' && (
            <div className='flex flex-1 flex-col overflow-y-auto p-4'>
              <div className='mb-3'>
                <h3 className='text-sm font-bold text-stone-900'>Tải lên</h3>
                <p className='text-xs text-stone-500'>
                  Tải ảnh từ máy tính để chèn vào slide
                </p>
              </div>

              {/* Input file ẩn */}
              <input
                ref={fileInputRef}
                type='file'
                accept='image/jpeg,image/png,image/webp,image/gif,image/svg+xml'
                onChange={handleFileChange}
                className='hidden'
              />

              {/* Nút lớn Tải hình ảnh lên */}
              <button
                type='button'
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className='flex w-full items-center justify-center gap-2 rounded-lg bg-brand-rust py-3 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition hover:bg-[#b04f35] active:scale-95 disabled:opacity-60'
              >
                <span>☁️</span>
                <span>
                  {isUploading ? 'Đang tải lên...' : 'Tải hình ảnh lên'}
                </span>
              </button>

              <span className='mt-2 block text-center text-[10px] text-stone-400'>
                Hỗ trợ PNG, JPG, WEBP, GIF, SVG (Tối đa 5MB)
              </span>

              {/* Thư viện hình ảnh đã tải lên */}
              <div className='mt-5 flex-1'>
                <div className='mb-2 flex items-center justify-between'>
                  <span className='text-[11px] font-bold uppercase tracking-wider text-stone-500'>
                    Ảnh của bạn ({uploadedImages.length})
                  </span>
                </div>

                {uploadedImages.length > 0 ? (
                  <div className='grid grid-cols-2 gap-2.5'>
                    {uploadedImages.map((img) => (
                      <div
                        key={img.id}
                        onClick={() => onAddImageComponent(img.url)}
                        className='group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-stone-200 bg-stone-100 transition hover:border-brand-rust hover:shadow-md'
                        title={`Click để chèn ảnh: ${img.name}`}
                      >
                        <img
                          src={img.url}
                          alt={img.name}
                          className='h-full w-full object-cover transition duration-150 group-hover:scale-105'
                        />

                        {/* Nút xóa ảnh */}
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation()
                            removeUploadedImage(img.id)
                          }}
                          className='absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-stone-900/70 text-xs text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100'
                          title='Xóa khỏi thư viện tải lên'
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 p-6 text-center'>
                    <span className='text-3xl text-stone-300'>🖼️</span>
                    <p className='mt-2 text-xs font-semibold text-stone-500'>
                      Chưa có hình ảnh nào
                    </p>
                    <p className='mt-1 text-[11px] text-stone-400'>
                      Bấm nút tải lên ở trên để bắt đầu thêm ảnh của bạn.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB MẪU SLIDE (TEMPLATES) */}
          {leftRailTab === 'templates' && (
            <div className='flex flex-1 flex-col overflow-y-auto p-4'>
              <div className='mb-4'>
                <h3 className='text-sm font-bold text-stone-900'>Mẫu bố cục</h3>
                <p className='text-xs text-stone-500'>
                  Chọn bố cục để áp dụng vào slide hiện tại
                </p>
              </div>

              <div className='space-y-3'>
                {/* Mẫu tiêu đề lớn */}
                <button
                  type='button'
                  onClick={() => onApplyTemplate('headline')}
                  className='w-full rounded-lg border border-stone-200 bg-stone-50 p-3 text-left transition hover:border-brand-rust hover:bg-brand-rust/5'
                >
                  <strong className='block text-xs font-bold text-stone-900 font-serif'>
                    Tiêu đề nổi bật (Headline)
                  </strong>
                  <span className='mt-1 block text-[11px] text-stone-500'>
                    Dành cho trang bìa hoặc thông điệp then chốt
                  </span>
                </button>

                {/* Mẫu 2 cột */}
                <button
                  type='button'
                  onClick={() => onApplyTemplate('two-column')}
                  className='w-full rounded-lg border border-stone-200 bg-stone-50 p-3 text-left transition hover:border-brand-rust hover:bg-brand-rust/5'
                >
                  <strong className='block text-xs font-bold text-stone-900'>
                    Hai cột đối xứng (Two Column)
                  </strong>
                  <span className='mt-1 block text-[11px] text-stone-500'>
                    So sánh hoặc chia nội dung thành 2 phần cân đối
                  </span>
                </button>

                {/* Mẫu trích dẫn */}
                <button
                  type='button'
                  onClick={() => onApplyTemplate('quote')}
                  className='w-full rounded-lg border border-stone-200 bg-stone-50 p-3 text-left transition hover:border-brand-rust hover:bg-brand-rust/5'
                >
                  <strong className='block text-xs font-bold text-stone-900 font-serif italic'>
                    Trích dẫn câu nói (Quote)
                  </strong>
                  <span className='mt-1 block text-[11px] text-stone-500'>
                    Nhấn mạnh trích dẫn của nhân vật hoặc bài học
                  </span>
                </button>

                {/* Mẫu chuẩn */}
                <button
                  type='button'
                  onClick={() => onApplyTemplate('standard')}
                  className='w-full rounded-lg border border-stone-200 bg-stone-50 p-3 text-left transition hover:border-brand-rust hover:bg-brand-rust/5'
                >
                  <strong className='block text-xs font-bold text-stone-900'>
                    Chuẩn (Tiêu đề + Ý chính)
                  </strong>
                  <span className='mt-1 block text-[11px] text-stone-500'>
                    Bố cục thông dụng nhất cho bài thuyết trình
                  </span>
                </button>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  )
}
