import { useToast } from '@/components/ui/Toast'
import type { ContentLayoutType, Outline, ShapeType } from '@/lib/types'
import {
  AlignLeft,
  BarChart3,
  Check,
  Columns,
  Grid2X2,
  Heading1,
  Heading2,
  LayoutGrid,
  LayoutTemplate,
  List,
  ListOrdered,
  Palette,
  Rows3,
  Shapes,
  Sparkles,
  Trash2,
  Type,
  UploadCloud
} from 'lucide-react'
import { useRef, useState } from 'react'
import { THEME_PRESETS } from '../constants/theme-options'
import { useEditorStore } from '../store/editor.store'

interface LeftSidebarRailProps {
  onAddTextComponent: (type: 'title' | 'subtitle' | 'text' | 'bullets') => void
  onAddImageComponent: (imageUrl: string) => void
  onAddShapeComponent: (shapeType: ShapeType) => void
  onApplyContentLayout?: (layout: ContentLayoutType) => void
  outline?: Outline | null
  currentThemeId?: string | null
  onThemeChange?: (themeId: string) => void
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

const SHAPE_ITEMS: Array<{
  type: ShapeType
  name: string
  icon: React.ReactNode
}> = [
  {
    type: 'rectangle',
    name: 'Chữ nhật',
    icon: (
      <div className='h-8 w-12 rounded-xs border-2 border-brand-rust bg-brand-rust/20' />
    )
  },
  {
    type: 'square',
    name: 'Hình vuông',
    icon: (
      <div className='h-8 w-8 rounded-xs border-2 border-brand-rust bg-brand-rust/20' />
    )
  },
  {
    type: 'circle',
    name: 'Hình tròn',
    icon: (
      <div className='h-8 w-8 rounded-full border-2 border-brand-rust bg-brand-rust/20' />
    )
  },
  {
    type: 'rounded-rect',
    name: 'Bo góc',
    icon: (
      <div className='h-8 w-12 rounded-lg border-2 border-brand-rust bg-brand-rust/20' />
    )
  },
  {
    type: 'triangle',
    name: 'Tam giác',
    icon: (
      <svg className='h-8 w-8 text-brand-rust' viewBox='0 0 24 24'>
        <polygon
          points='12,3 22,21 2,21'
          className='fill-brand-rust/20 stroke-brand-rust stroke-2'
        />
      </svg>
    )
  },
  {
    type: 'star',
    name: 'Ngôi sao',
    icon: (
      <svg className='h-8 w-8 text-brand-rust' viewBox='0 0 24 24'>
        <polygon
          points='12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26'
          className='fill-brand-rust/20 stroke-brand-rust stroke-2'
        />
      </svg>
    )
  },
  {
    type: 'line',
    name: 'Đường kẻ',
    icon: <div className='h-0.5 w-12 bg-brand-rust' />
  }
]

export const LeftSidebarRail = ({
  onAddTextComponent,
  onAddImageComponent,
  onAddShapeComponent,
  onApplyContentLayout,
  currentThemeId,
  onThemeChange
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

      addUploadedImage({
        url: dataUrl,
        name: file.name,
        size: file.size
      })

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
          <Type size={20} />
          <span className='mt-1 text-[10px] font-medium'>Văn bản</span>
        </button>

        {/* Tab Hình khối / Thành phần (MỚI) */}
        <button
          type='button'
          onClick={() => setLeftRailTab('shapes')}
          className={`group mt-2 flex w-15 flex-col items-center justify-center rounded-lg py-2.5 transition ${
            leftRailTab === 'shapes' && isDrawerOpen
              ? 'border-l-2 border-brand-rust bg-emerald-900/80 font-bold text-brand-rust'
              : 'hover:bg-emerald-900/40 hover:text-white'
          }`}
          title='Chèn hình khối'
        >
          <Shapes size={20} />
          <span className='mt-1 text-[10px] font-medium'>Hình khối</span>
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
          <UploadCloud size={20} />
          <span className='mt-1 text-[10px] font-medium'>Tải lên</span>
        </button>

        {/* Tab Mẫu slide */}
        <button
          type='button'
          onClick={() => setLeftRailTab('templates')}
          className={`group mt-2 flex w-15 flex-col items-center justify-center rounded-lg py-2.5 transition cursor-pointer ${
            leftRailTab === 'templates' && isDrawerOpen
              ? 'border-l-2 border-brand-rust bg-emerald-900/80 font-bold text-brand-rust'
              : 'hover:bg-emerald-900/40 hover:text-white'
          }`}
          title='Bố cục mẫu slide'
        >
          <LayoutTemplate size={20} />
          <span className='mt-1 text-[10px] font-medium'>Mẫu slide</span>
        </button>

        {/* Tab Giao diện / Theme */}
        <button
          type='button'
          onClick={() => setLeftRailTab('theme')}
          className={`group mt-2 flex w-15 flex-col items-center justify-center rounded-lg py-2.5 transition cursor-pointer ${
            leftRailTab === 'theme' && isDrawerOpen
              ? 'border-l-2 border-brand-rust bg-emerald-900/80 font-bold text-brand-rust'
              : 'hover:bg-emerald-900/40 hover:text-white'
          }`}
          title='Đổi bộ giao diện bài giảng (Theme)'
        >
          <Palette size={20} />
          <span className='mt-1 text-[10px] font-medium'>Giao diện</span>
        </button>
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
                  <div className='flex items-center gap-2.5'>
                    <Heading1 size={20} className='text-brand-rust' />
                    <span>Thêm tiêu đề lớn</span>
                  </div>
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
                  <div className='flex items-center gap-2.5'>
                    <Heading2 size={18} className='text-stone-600' />
                    <span>Thêm tiêu đề phụ</span>
                  </div>
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
                  <div className='flex items-center gap-2.5'>
                    <AlignLeft size={16} className='text-stone-500' />
                    <span>Thêm nội dung văn bản</span>
                  </div>
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
                  <div className='flex items-center gap-2.5'>
                    <List size={16} className='text-stone-500' />
                    <span>Danh sách ý (Bullets)</span>
                  </div>
                  <span className='text-[10px] font-mono text-stone-400'>
                    List
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB HÌNH KHỐI (SHAPES - MỚI) */}
          {leftRailTab === 'shapes' && (
            <div className='flex flex-1 flex-col overflow-y-auto p-4'>
              <div className='mb-3'>
                <h3 className='text-sm font-bold text-stone-900'>Hình khối</h3>
                <p className='text-xs text-stone-500'>
                  Click để chèn hình khối vào slide
                </p>
              </div>

              <div className='grid grid-cols-2 gap-2.5'>
                {SHAPE_ITEMS.map((item) => (
                  <button
                    key={item.type}
                    type='button'
                    onClick={() => onAddShapeComponent(item.type)}
                    className='group flex flex-col items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 transition hover:border-brand-rust hover:bg-brand-rust/5 hover:shadow-xs active:scale-95'
                    title={`Chèn ${item.name}`}
                  >
                    <div className='flex h-10 items-center justify-center transition group-hover:scale-110'>
                      {item.icon}
                    </div>
                    <span className='text-xs font-semibold text-stone-700 group-hover:text-brand-rust'>
                      {item.name}
                    </span>
                  </button>
                ))}
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
                className='flex w-full items-center justify-center gap-2 rounded-lg bg-brand-rust py-3 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition hover:bg-[#b04f35] active:scale-95 disabled:opacity-60 cursor-pointer'
              >
                <UploadCloud size={18} />
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
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 p-6 text-center'>
                    <UploadCloud size={36} className='text-stone-300' />
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
                <h3 className='text-sm font-bold text-stone-900'>
                  Mẫu bố cục trực quan
                </h3>
                <p className='text-xs text-stone-500'>
                  Chọn kiểu bố cục hiện đại để áp dụng vào slide hiện tại
                </p>
              </div>

              <div className='space-y-2.5'>
                {/* 1. Mẫu Trọng tâm & Bổ trợ (Split Highlight) */}
                <button
                  type='button'
                  onClick={() => onApplyContentLayout?.('split-highlight')}
                  className='w-full rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-brand-rust hover:bg-brand-rust/5 shadow-2xs group cursor-pointer'
                >
                  <div className='flex items-center gap-2 mb-1'>
                    <Sparkles size={15} className='text-brand-rust' />
                    <strong className='text-xs font-bold text-stone-900 group-hover:text-brand-rust transition'>
                      Trọng tâm & Bổ trợ (Split)
                    </strong>
                  </div>
                  <span className='block text-[11px] text-stone-500'>
                    1 thẻ Hero nổi bật bên trái và 2 thẻ con xếp chồng bên phải
                  </span>
                </button>

                {/* 2. Mẫu Số liệu & Thống kê (Metrics Grid) */}
                <button
                  type='button'
                  onClick={() => onApplyContentLayout?.('metrics-grid')}
                  className='w-full rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-brand-rust hover:bg-brand-rust/5 shadow-2xs group cursor-pointer'
                >
                  <div className='flex items-center gap-2 mb-1'>
                    <BarChart3 size={15} className='text-brand-rust' />
                    <strong className='text-xs font-bold text-stone-900 group-hover:text-brand-rust transition'>
                      Số liệu thống kê (Metrics)
                    </strong>
                  </div>
                  <span className='block text-[11px] text-stone-500'>
                    Các con số đo lường kích thước lớn kèm nhãn và phân tích
                  </span>
                </button>

                {/* 3. Mẫu Lưới 4 ô (Quad Grid 2x2) */}
                <button
                  type='button'
                  onClick={() => onApplyContentLayout?.('quad-grid')}
                  className='w-full rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-brand-rust hover:bg-brand-rust/5 shadow-2xs group cursor-pointer'
                >
                  <div className='flex items-center gap-2 mb-1'>
                    <Grid2X2 size={15} className='text-brand-rust' />
                    <strong className='text-xs font-bold text-stone-900 group-hover:text-brand-rust transition'>
                      Lưới 4 ô cân xứng (Quad Grid)
                    </strong>
                  </div>
                  <span className='block text-[11px] text-stone-500'>
                    4 ô vuông vức bo góc phân bố 2x2 (mô hình SWOT, 4 trụ cột)
                  </span>
                </button>

                {/* 4. Mẫu Hàng ngang xếp tầng (Horizontal Rows) */}
                <button
                  type='button'
                  onClick={() => onApplyContentLayout?.('horizontal-rows')}
                  className='w-full rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-brand-rust hover:bg-brand-rust/5 shadow-2xs group cursor-pointer'
                >
                  <div className='flex items-center gap-2 mb-1'>
                    <Rows3 size={15} className='text-brand-rust' />
                    <strong className='text-xs font-bold text-stone-900 group-hover:text-brand-rust transition'>
                      Thanh ngang xếp tầng (Rows)
                    </strong>
                  </div>
                  <span className='block text-[11px] text-stone-500'>
                    3 thanh thẻ trải dài ngang với huy hiệu thứ tự ở đầu
                  </span>
                </button>

                {/* 5. Mẫu Thẻ cột (Cards) */}
                <button
                  type='button'
                  onClick={() => onApplyContentLayout?.('cards')}
                  className='w-full rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-brand-rust hover:bg-brand-rust/5 shadow-2xs group cursor-pointer'
                >
                  <div className='flex items-center gap-2 mb-1'>
                    <LayoutGrid size={15} className='text-brand-rust' />
                    <strong className='text-xs font-bold text-stone-900 group-hover:text-brand-rust transition'>
                      Thẻ cột song song (Cards)
                    </strong>
                  </div>
                  <span className='block text-[11px] text-stone-500'>
                    3 khối thẻ song song với nền bo góc, tiêu đề và mô tả
                  </span>
                </button>

                {/* 6. Mẫu Tiến trình từng bước (Steps) */}
                <button
                  type='button'
                  onClick={() => onApplyContentLayout?.('steps')}
                  className='w-full rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-brand-rust hover:bg-brand-rust/5 shadow-2xs group cursor-pointer'
                >
                  <div className='flex items-center gap-2 mb-1'>
                    <ListOrdered size={15} className='text-brand-rust' />
                    <strong className='text-xs font-bold text-stone-900 group-hover:text-brand-rust transition'>
                      Quy trình tuần tự (Steps)
                    </strong>
                  </div>
                  <span className='block text-[11px] text-stone-500'>
                    Các bước 01, 02, 03 đánh số thứ tự trực quan cho quy trình
                  </span>
                </button>

                {/* 7. Mẫu Hai cột (Two Column) */}
                <button
                  type='button'
                  onClick={() => onApplyContentLayout?.('two-column')}
                  className='w-full rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-brand-rust hover:bg-brand-rust/5 shadow-2xs group cursor-pointer'
                >
                  <div className='flex items-center gap-2 mb-1'>
                    <Columns size={15} className='text-brand-rust' />
                    <strong className='text-xs font-bold text-stone-900 group-hover:text-brand-rust transition'>
                      Hai cột đối xứng (Two Column)
                    </strong>
                  </div>
                  <span className='block text-[11px] text-stone-500'>
                    So sánh đối xứng hoặc chia nội dung thành 2 phần cân đối
                  </span>
                </button>

                {/* 8. Mẫu Tiêu đề lớn / Bìa (Headline) */}
                <button
                  type='button'
                  onClick={() => onApplyContentLayout?.('headline')}
                  className='w-full rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-brand-rust hover:bg-brand-rust/5 shadow-2xs group cursor-pointer'
                >
                  <div className='flex items-center gap-2 mb-1'>
                    <Heading1 size={15} className='text-brand-rust' />
                    <strong className='text-xs font-bold text-stone-900 group-hover:text-brand-rust transition'>
                      Tiêu đề lớn & Bìa (Headline)
                    </strong>
                  </div>
                  <span className='block text-[11px] text-stone-500'>
                    Slide mở đầu hoặc phân chia chương mới căn giữa trang trọng
                  </span>
                </button>

                {/* 9. Mẫu Tiêu chuẩn (Standard) */}
                <button
                  type='button'
                  onClick={() => onApplyContentLayout?.('standard')}
                  className='w-full rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-brand-rust hover:bg-brand-rust/5 shadow-2xs group cursor-pointer'
                >
                  <div className='flex items-center gap-2 mb-1'>
                    <AlignLeft size={15} className='text-brand-rust' />
                    <strong className='text-xs font-bold text-stone-900 group-hover:text-brand-rust transition'>
                      Ý chính tiêu chuẩn (Standard)
                    </strong>
                  </div>
                  <span className='block text-[11px] text-stone-500'>
                    Các ý chính phân cấp rõ ràng theo phong cách truyền thống
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB GIAO DIỆN (THEME) */}
          {leftRailTab === 'theme' && (
            <div className='flex flex-1 flex-col overflow-y-auto p-4'>
              <div className='mb-4'>
                <h3 className='text-sm font-bold text-stone-900'>
                  Bộ giao diện bài giảng
                </h3>
                <p className='text-xs text-stone-500'>
                  Chọn bộ phong cách, bảng màu và phông chữ cho toàn bài giảng
                </p>
              </div>

              <div className='space-y-2.5'>
                {THEME_PRESETS.map((t) => {
                  const isSelected =
                    (currentThemeId || 'classic-editorial') === t.id
                  return (
                    <button
                      key={t.id}
                      type='button'
                      onClick={() => onThemeChange?.(t.id)}
                      className={`w-full flex items-center justify-between gap-3 rounded-xl p-3 text-left transition border cursor-pointer ${
                        isSelected
                          ? 'border-brand-rust bg-brand-paper shadow-sm ring-1 ring-brand-rust'
                          : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <div className='flex items-center gap-3 min-w-0'>
                        {/* Bảng màu đại diện */}
                        <div className='flex -space-x-1.5 shrink-0'>
                          <div
                            className='h-6 w-6 rounded-full border border-stone-300 shadow-2xs'
                            style={{ backgroundColor: t.background }}
                            title={`Nền: ${t.background}`}
                          />
                          <div
                            className='h-6 w-6 rounded-full border border-stone-300 shadow-2xs'
                            style={{ backgroundColor: t.textPrimary }}
                            title={`Chữ: ${t.textPrimary}`}
                          />
                          <div
                            className='h-6 w-6 rounded-full border border-stone-300 shadow-2xs'
                            style={{ backgroundColor: t.accentColor }}
                            title={`Nhấn: ${t.accentColor}`}
                          />
                        </div>
                        <div className='min-w-0'>
                          <div className='text-xs font-bold text-stone-900 truncate'>
                            {t.name}
                          </div>
                          <div className='text-[11px] text-stone-500 line-clamp-1'>
                            {t.description}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-rust text-white'>
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  )
}
