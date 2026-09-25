import type { ShapeType, SlideComponent } from '@/lib/types'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CaseUpper,
  Circle,
  Copy,
  Image as ImageIcon,
  Italic,
  List,
  Minus,
  PaintBucket,
  Plus,
  RotateCw,
  Shapes,
  Square,
  Trash2,
  Triangle,
  Type,
  Underline
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { COLOR_PALETTES, FONT_OPTIONS } from '../constants/theme-options'

interface FloatingContextualToolbarProps {
  selectedComponent: SlideComponent | null
  onUpdateComponent: (patch: Partial<SlideComponent>) => void
  onDuplicateComponent: (comp: SlideComponent) => void
  onDeleteComponent: (id: string) => void
}

const BORDER_WIDTHS = [0, 1, 2, 4, 8]
const BORDER_RADII = [0, 4, 8, 16, 9999]

interface ColorPickerModalProps {
  title: string
  currentColor: string
  onChange: (color: string) => void
  allowTransparent?: boolean
  onClose: () => void
}

const ColorPickerModal = ({
  title,
  currentColor,
  onChange,
  allowTransparent = false
}: ColorPickerModalProps) => {
  const [customHex, setCustomHex] = useState(
    currentColor.startsWith('#') ? currentColor : '#173c39'
  )

  const handleApplyHex = (val: string) => {
    setCustomHex(val)
    if (/^#[0-9A-Fa-f]{6}$/i.test(val) || /^#[0-9A-Fa-f]{3}$/i.test(val)) {
      onChange(val)
    }
  }

  return (
    <div className='absolute left-0 top-9 z-50 flex w-72 flex-col gap-2.5 rounded-xl border border-stone-200 bg-white p-3 shadow-2xl backdrop-blur-md'>
      <div className='flex items-center justify-between border-b border-stone-100 pb-1.5'>
        <span className='text-xs font-bold text-stone-800'>{title}</span>
        {allowTransparent && (
          <button
            type='button'
            onClick={() => onChange('transparent')}
            className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
              currentColor === 'transparent'
                ? 'bg-brand-rust/15 font-bold text-brand-rust'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Trong suốt
          </button>
        )}
      </div>

      {/* Danh sách các bảng màu phong phú theo nhóm */}
      <div className='max-h-56 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar'>
        {COLOR_PALETTES.map((group) => (
          <div key={group.name} className='space-y-1'>
            <span className='block text-[10px] font-bold uppercase tracking-wider text-stone-400'>
              {group.name}
            </span>
            <div className='flex flex-wrap gap-1.5'>
              {group.colors.map((c) => (
                <button
                  key={c.value}
                  type='button'
                  onClick={() => onChange(c.value)}
                  style={{ backgroundColor: c.value }}
                  className={`h-5 w-5 rounded-full border transition hover:scale-125 ${
                    currentColor === c.value
                      ? 'ring-2 ring-brand-rust ring-offset-1 border-stone-400'
                      : 'border-stone-200'
                  }`}
                  title={`${c.name} (${c.value})`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tùy chỉnh màu tự do (Custom Color Picker Wheel + Hex) */}
      <div className='border-t border-stone-100 pt-2'>
        <span className='block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5'>
          Tùy chỉnh mã màu:
        </span>
        <div className='flex items-center gap-2'>
          <input
            type='color'
            value={customHex}
            onChange={(e) => {
              const val = e.target.value
              setCustomHex(val)
              onChange(val)
            }}
            className='h-8 w-8 cursor-pointer rounded border border-stone-300 p-0.5 bg-transparent'
            title='Mở vòng chọn màu'
          />
          <input
            type='text'
            value={customHex}
            onChange={(e) => handleApplyHex(e.target.value)}
            placeholder='#HEX'
            className='h-8 flex-1 rounded border border-stone-200 px-2 font-mono text-xs text-stone-800 uppercase outline-none focus:border-brand-rust'
          />
        </div>
      </div>
    </div>
  )
}

export const FloatingContextualToolbar = ({
  selectedComponent,
  onUpdateComponent,
  onDuplicateComponent,
  onDeleteComponent
}: FloatingContextualToolbarProps) => {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)
  const [isFillPickerOpen, setIsFillPickerOpen] = useState(false)
  const [isBorderColorPickerOpen, setIsBorderColorPickerOpen] = useState(false)

  const colorPickerRef = useRef<HTMLDivElement>(null)
  const fillPickerRef = useRef<HTMLDivElement>(null)
  const borderPickerRef = useRef<HTMLDivElement>(null)

  // Đóng các popover màu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (colorPickerRef.current && !colorPickerRef.current.contains(target)) {
        setIsColorPickerOpen(false)
      }
      if (fillPickerRef.current && !fillPickerRef.current.contains(target)) {
        setIsFillPickerOpen(false)
      }
      if (
        borderPickerRef.current &&
        !borderPickerRef.current.contains(target)
      ) {
        setIsBorderColorPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!selectedComponent) {
    return null
  }

  // TRƯỜNG HỢP 1: ĐỐI TƯỢNG HÌNH ẢNH (IMAGE)
  if (selectedComponent.type === 'image') {
    const currentWidth = selectedComponent.width ?? 40

    return (
      <div className='flex h-11 items-center gap-2 rounded-full border border-stone-300 bg-white/95 px-4 shadow-md backdrop-blur-xs select-none'>
        <span className='flex items-center gap-1.5 rounded-full bg-brand-rust/10 px-2.5 py-1 text-xs font-bold text-brand-rust'>
          <ImageIcon size={14} />
          <span>Hình ảnh</span>
        </span>

        <span className='h-4 w-px bg-stone-200' />

        {/* Kích thước chiều rộng ảnh (%) */}
        <div className='flex items-center gap-1'>
          <span className='text-[11px] font-medium text-stone-500'>Rộng:</span>
          <button
            type='button'
            onClick={() =>
              onUpdateComponent({
                width: Math.max(10, currentWidth - 5)
              })
            }
            className='flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-100'
            title='Thu nhỏ ảnh'
          >
            <Minus size={12} />
          </button>
          <span className='w-10 text-center font-mono text-xs font-bold text-stone-800'>
            {currentWidth}%
          </span>
          <button
            type='button'
            onClick={() =>
              onUpdateComponent({
                width: Math.min(95, currentWidth + 5)
              })
            }
            className='flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-100'
            title='Phóng to ảnh'
          >
            <Plus size={12} />
          </button>
        </div>

        <span className='h-4 w-px bg-stone-200' />

        {/* Xoay ảnh */}
        <div className='flex items-center gap-1'>
          <span className='text-[11px] font-medium text-stone-500'>Xoay:</span>
          <button
            type='button'
            onClick={() =>
              onUpdateComponent({
                rotation: ((selectedComponent.rotation ?? 0) + 90) % 360
              })
            }
            className='flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-xs font-bold text-stone-700 hover:bg-stone-100 transition'
            title='Xoay 90° cùng chiều kim đồng hồ'
          >
            <RotateCw size={12} />
            <span className='font-mono text-[11px]'>
              {selectedComponent.rotation ?? 0}°
            </span>
          </button>
          {(selectedComponent.rotation ?? 0) !== 0 && (
            <button
              type='button'
              onClick={() => onUpdateComponent({ rotation: 0 })}
              className='flex h-7 items-center rounded-md px-1.5 text-[10px] font-semibold text-stone-500 hover:bg-stone-100 transition'
              title='Đặt lại góc xoay về 0°'
            >
              0°
            </button>
          )}
        </div>

        <span className='h-4 w-px bg-stone-200' />

        {/* Nhân bản */}
        <button
          type='button'
          onClick={() => onDuplicateComponent(selectedComponent)}
          className='flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100'
          title='Nhân bản ảnh'
        >
          <Copy size={13} />
          <span>Nhân bản</span>
        </button>

        {/* Xóa */}
        <button
          type='button'
          onClick={() => onDeleteComponent(selectedComponent.id)}
          className='flex h-7 w-7 items-center justify-center rounded-md text-red-600 hover:bg-red-50'
          title='Xóa ảnh khỏi slide'
        >
          <Trash2 size={14} />
        </button>
      </div>
    )
  }

  // TRƯỜNG HỢP 2: ĐỐI TƯỢNG HÌNH KHỐI (SHAPE)
  if (selectedComponent.type === 'shape') {
    const shapeType: ShapeType = selectedComponent.shapeType || 'rectangle'
    const fillColor = selectedComponent.fillColor || '#c45b3f'
    const borderColor = selectedComponent.borderColor || '#173c39'
    const borderWidth = selectedComponent.borderWidth ?? 0
    const borderRadius = selectedComponent.borderRadius ?? 0
    const currentWidth = selectedComponent.width ?? 30
    const currentHeight = selectedComponent.height ?? 20

    const getShapeName = (type: ShapeType) => {
      switch (type) {
        case 'rectangle':
          return 'Chữ nhật'
        case 'square':
          return 'Vuông'
        case 'circle':
          return 'Tròn'
        case 'rounded-rect':
          return 'Bo góc'
        case 'triangle':
          return 'Tam giác'
        case 'star':
          return 'Ngôi sao'
        case 'line':
          return 'Đường kẻ'
        default:
          return 'Hình khối'
      }
    }

    const renderShapeIcon = (type: ShapeType) => {
      switch (type) {
        case 'circle':
          return <Circle size={14} />
        case 'triangle':
          return <Triangle size={14} />
        case 'star':
          return <Shapes size={14} />
        default:
          return <Square size={14} />
      }
    }

    return (
      <div className='flex h-11 items-center gap-2 rounded-full border border-stone-300 bg-white/95 px-3.5 shadow-md backdrop-blur-xs select-none'>
        {/* Nhãn hình khối */}
        <span className='flex items-center gap-1.5 rounded-full bg-brand-rust/10 px-2.5 py-1 text-xs font-bold text-brand-rust'>
          {renderShapeIcon(shapeType)}
          <span>{getShapeName(shapeType)}</span>
        </span>

        <span className='h-4 w-px bg-stone-200' />

        {/* 1. Màu nền (Fill Color) */}
        <div className='relative' ref={fillPickerRef}>
          <button
            type='button'
            onClick={() => {
              setIsFillPickerOpen((prev) => !prev)
              setIsBorderColorPickerOpen(false)
            }}
            className='flex h-7 items-center gap-1.5 rounded-md border border-stone-200 px-2 text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer'
            title='Chọn màu nền tô'
          >
            <PaintBucket size={14} className='text-stone-600' />
            <span
              className='h-3.5 w-3.5 rounded-xs border border-stone-300 shadow-2xs'
              style={{
                backgroundColor:
                  fillColor === 'transparent' ? 'transparent' : fillColor,
                backgroundImage:
                  fillColor === 'transparent'
                    ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                    : 'none',
                backgroundSize: '4px 4px'
              }}
            />
          </button>

          {isFillPickerOpen && (
            <ColorPickerModal
              title='Màu nền hình khối'
              currentColor={fillColor}
              onChange={(color) => onUpdateComponent({ fillColor: color })}
              allowTransparent={true}
              onClose={() => setIsFillPickerOpen(false)}
            />
          )}
        </div>

        {/* 2. Màu viền (Border Color) */}
        <div className='relative' ref={borderPickerRef}>
          <button
            type='button'
            onClick={() => {
              setIsBorderColorPickerOpen((prev) => !prev)
              setIsFillPickerOpen(false)
            }}
            className='flex h-7 items-center gap-1.5 rounded-md border border-stone-200 px-2 text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer'
            title='Chọn màu viền'
          >
            <Square size={13} className='text-stone-600' />
            <span
              className='h-3.5 w-3.5 rounded-xs border-2 shadow-2xs'
              style={{ borderColor: borderColor }}
            />
          </button>

          {isBorderColorPickerOpen && (
            <ColorPickerModal
              title='Màu đường viền'
              currentColor={borderColor}
              onChange={(color) => onUpdateComponent({ borderColor: color })}
              allowTransparent={false}
              onClose={() => setIsBorderColorPickerOpen(false)}
            />
          )}
        </div>

        {/* 3. Độ dày viền (Border Width) */}
        <div className='flex items-center gap-1'>
          <span className='text-[10px] font-medium text-stone-500'>Viền:</span>
          <select
            value={borderWidth}
            onChange={(e) =>
              onUpdateComponent({ borderWidth: Number(e.target.value) })
            }
            className='h-7 rounded-md border border-stone-200 bg-transparent px-1.5 font-mono text-xs font-medium text-stone-800 outline-none hover:bg-stone-50 cursor-pointer'
            title='Độ dày đường viền'
          >
            {BORDER_WIDTHS.map((w) => (
              <option key={w} value={w}>
                {w === 0 ? '0px (Không viền)' : `${w}px`}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Bo góc (Border Radius - cho chữ nhật / vuông) */}
        {['rectangle', 'square', 'rounded-rect'].includes(shapeType) && (
          <div className='flex items-center gap-1'>
            <span className='text-[10px] font-medium text-stone-500'>Góc:</span>
            <select
              value={borderRadius}
              onChange={(e) =>
                onUpdateComponent({ borderRadius: Number(e.target.value) })
              }
              className='h-7 rounded-md border border-stone-200 bg-transparent px-1.5 font-mono text-xs font-medium text-stone-800 outline-none hover:bg-stone-50 cursor-pointer'
              title='Độ bo tròn góc'
            >
              {BORDER_RADII.map((r) => (
                <option key={r} value={r}>
                  {r === 0 ? '0px' : r === 9999 ? 'Tròn' : `${r}px`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 5. Kích thước chiều rộng (%) */}
        <div className='flex items-center gap-0.5'>
          <span className='text-[10px] font-medium text-stone-500'>R:</span>
          <button
            type='button'
            onClick={() =>
              onUpdateComponent({
                width: Math.max(5, currentWidth - 5)
              })
            }
            className='flex h-7 w-5 items-center justify-center rounded-l-md border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-100'
            title='Giảm chiều rộng'
          >
            <Minus size={10} />
          </button>
          <span className='w-8 text-center font-mono text-[11px] font-bold text-stone-800'>
            {currentWidth}%
          </span>
          <button
            type='button'
            onClick={() =>
              onUpdateComponent({
                width: Math.min(95, currentWidth + 5)
              })
            }
            className='flex h-7 w-5 items-center justify-center rounded-r-md border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-100'
            title='Tăng chiều rộng'
          >
            <Plus size={10} />
          </button>
        </div>

        {/* 6. Kích thước chiều cao (%) - ngoại trừ đường kẻ */}
        {shapeType !== 'line' && (
          <div className='flex items-center gap-0.5'>
            <span className='text-[10px] font-medium text-stone-500'>C:</span>
            <button
              type='button'
              onClick={() =>
                onUpdateComponent({
                  height: Math.max(5, currentHeight - 5)
                })
              }
              className='flex h-7 w-5 items-center justify-center rounded-l-md border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-100'
              title='Giảm chiều cao'
            >
              <Minus size={10} />
            </button>
            <span className='w-8 text-center font-mono text-[11px] font-bold text-stone-800'>
              {currentHeight}%
            </span>
            <button
              type='button'
              onClick={() =>
                onUpdateComponent({
                  height: Math.min(95, currentHeight + 5)
                })
              }
              className='flex h-7 w-5 items-center justify-center rounded-r-md border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-100'
              title='Tăng chiều cao'
            >
              <Plus size={10} />
            </button>
          </div>
        )}

        <span className='h-4 w-px bg-stone-200' />

        {/* Xoay hình khối */}
        <div className='flex items-center gap-1'>
          <span className='text-[11px] font-medium text-stone-500'>Xoay:</span>
          <button
            type='button'
            onClick={() =>
              onUpdateComponent({
                rotation: ((selectedComponent.rotation ?? 0) + 90) % 360
              })
            }
            className='flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-xs font-bold text-stone-700 hover:bg-stone-100 transition'
            title='Xoay 90° cùng chiều kim đồng hồ'
          >
            <RotateCw size={12} />
            <span className='font-mono text-[11px]'>
              {selectedComponent.rotation ?? 0}°
            </span>
          </button>
          {(selectedComponent.rotation ?? 0) !== 0 && (
            <button
              type='button'
              onClick={() => onUpdateComponent({ rotation: 0 })}
              className='flex h-7 items-center rounded-md px-1.5 text-[10px] font-semibold text-stone-500 hover:bg-stone-100 transition'
              title='Đặt lại góc xoay về 0°'
            >
              0°
            </button>
          )}
        </div>

        <span className='h-4 w-px bg-stone-200' />

        {/* Nhân bản */}
        <button
          type='button'
          onClick={() => onDuplicateComponent(selectedComponent)}
          className='flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100'
          title='Nhân bản hình khối'
        >
          <Copy size={13} />
        </button>

        {/* Xóa */}
        <button
          type='button'
          onClick={() => onDeleteComponent(selectedComponent.id)}
          className='flex h-7 w-7 items-center justify-center rounded-md text-red-600 hover:bg-red-50'
          title='Xóa hình khối'
        >
          <Trash2 size={14} />
        </button>
      </div>
    )
  }

  // TRƯỜNG HỢP 3: ĐỐI TƯỢNG VĂN BẢN (Text, Title, Subtitle, Bullets, Quote)
  const currentFontSize = selectedComponent.fontSize ?? 20
  const isBold = selectedComponent.fontWeight === 'bold'
  const isItalic = selectedComponent.fontStyle === 'italic'
  const isUnderline = selectedComponent.textDecoration === 'underline'
  const isUppercase = selectedComponent.textCase === 'uppercase'
  const textAlign = selectedComponent.textAlign || 'left'

  return (
    <div className='flex h-11 items-center gap-1.5 rounded-full border border-stone-200 bg-white/95 px-3.5 shadow-md backdrop-blur-xs select-none'>
      {/* 1. Phông chữ (Canva font picker với 8 phông chữ phong phú) */}
      <div className='flex items-center gap-1'>
        <Type size={14} className='text-stone-500' />
        <select
          value={selectedComponent.fontFamily || 'sans'}
          onChange={(e) =>
            onUpdateComponent({
              fontFamily: e.target.value
            })
          }
          className='h-7 max-w-[155px] rounded-md border border-stone-200 bg-transparent px-2 text-xs font-medium text-stone-800 outline-none hover:bg-stone-50 cursor-pointer'
          title='Chọn phông chữ'
        >
          {FONT_OPTIONS.map((f) => (
            <option
              key={f.key}
              value={f.key}
              style={{ fontFamily: f.fontFamily }}
            >
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <span className='h-4 w-px bg-stone-200' />

      {/* 2. Cỡ chữ (- [size] +) */}
      <div className='flex items-center gap-0.5'>
        <button
          type='button'
          onClick={() =>
            onUpdateComponent({
              fontSize: Math.max(10, currentFontSize - 2)
            })
          }
          className='flex h-7 w-6 items-center justify-center rounded-l-md border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-100'
          title='Giảm cỡ chữ'
        >
          <Minus size={12} />
        </button>
        <input
          type='number'
          value={currentFontSize}
          onChange={(e) =>
            onUpdateComponent({
              fontSize: Math.max(8, Math.min(120, Number(e.target.value) || 20))
            })
          }
          className='h-7 w-11 border-y border-stone-200 text-center font-mono text-xs font-bold text-stone-800 outline-none'
          title='Nhập cỡ chữ'
        />
        <button
          type='button'
          onClick={() =>
            onUpdateComponent({
              fontSize: Math.min(120, currentFontSize + 2)
            })
          }
          className='flex h-7 w-6 items-center justify-center rounded-r-md border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-100'
          title='Tăng cỡ chữ'
        >
          <Plus size={12} />
        </button>
      </div>

      <span className='h-4 w-px bg-stone-200' />

      {/* 3. Màu chữ (Canva 'A' with color swatch + color modal phong phú) */}
      <div className='relative' ref={colorPickerRef}>
        <button
          type='button'
          onClick={() => setIsColorPickerOpen((prev) => !prev)}
          className='flex h-7 flex-col items-center justify-center rounded-md px-2 hover:bg-stone-100 cursor-pointer'
          title='Màu chữ'
        >
          <span className='text-xs font-bold text-stone-900 leading-none'>
            A
          </span>
          <span
            className='mt-0.5 h-1 w-4 rounded-full border border-stone-300'
            style={{ backgroundColor: selectedComponent.color || '#173c39' }}
          />
        </button>

        {isColorPickerOpen && (
          <ColorPickerModal
            title='Bảng màu chữ'
            currentColor={selectedComponent.color || '#173c39'}
            onChange={(color) => onUpdateComponent({ color })}
            allowTransparent={false}
            onClose={() => setIsColorPickerOpen(false)}
          />
        )}
      </div>

      {/* 4. Định dạng chữ: Bold, Italic, Underline, Uppercase */}
      <div className='flex items-center gap-0.5'>
        {/* Bold */}
        <button
          type='button'
          onClick={() =>
            onUpdateComponent({
              fontWeight: isBold ? 'normal' : 'bold'
            })
          }
          className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
            isBold
              ? 'bg-brand-rust/15 text-brand-rust font-black'
              : 'text-stone-700 hover:bg-stone-100'
          }`}
          title='In đậm (Ctrl+B)'
        >
          <Bold size={13} />
        </button>

        {/* Italic */}
        <button
          type='button'
          onClick={() =>
            onUpdateComponent({
              fontStyle: isItalic ? 'normal' : 'italic'
            })
          }
          className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
            isItalic
              ? 'bg-brand-rust/15 text-brand-rust font-bold'
              : 'text-stone-700 hover:bg-stone-100'
          }`}
          title='In nghiêng (Ctrl+I)'
        >
          <Italic size={13} />
        </button>

        {/* Underline */}
        <button
          type='button'
          onClick={() =>
            onUpdateComponent({
              textDecoration: isUnderline ? 'none' : 'underline'
            })
          }
          className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
            isUnderline
              ? 'bg-brand-rust/15 text-brand-rust font-bold'
              : 'text-stone-700 hover:bg-stone-100'
          }`}
          title='Gạch chân (Ctrl+U)'
        >
          <Underline size={13} />
        </button>

        {/* Uppercase toggle (aA) */}
        <button
          type='button'
          onClick={() =>
            onUpdateComponent({
              textCase: isUppercase ? 'normal' : 'uppercase'
            })
          }
          className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
            isUppercase
              ? 'bg-brand-rust/15 text-brand-rust'
              : 'text-stone-700 hover:bg-stone-100'
          }`}
          title='Chuyển đổi CHỮ HOA / chữ thường'
        >
          <CaseUpper size={13} />
        </button>
      </div>

      <span className='h-4 w-px bg-stone-200' />

      {/* 5. Căn lề: Trái / Giữa / Phải */}
      <div className='flex items-center gap-0.5'>
        <button
          type='button'
          onClick={() => onUpdateComponent({ textAlign: 'left' })}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
            textAlign === 'left'
              ? 'bg-brand-rust/15 text-brand-rust font-bold'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
          title='Căn trái'
        >
          <AlignLeft size={13} />
        </button>
        <button
          type='button'
          onClick={() => onUpdateComponent({ textAlign: 'center' })}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
            textAlign === 'center'
              ? 'bg-brand-rust/15 text-brand-rust font-bold'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
          title='Căn giữa'
        >
          <AlignCenter size={13} />
        </button>
        <button
          type='button'
          onClick={() => onUpdateComponent({ textAlign: 'right' })}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
            textAlign === 'right'
              ? 'bg-brand-rust/15 text-brand-rust font-bold'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
          title='Căn phải'
        >
          <AlignRight size={13} />
        </button>
      </div>

      {/* 6. Bullets toggle */}
      <button
        type='button'
        onClick={() =>
          onUpdateComponent({
            type: selectedComponent.type === 'bullets' ? 'text' : 'bullets'
          })
        }
        className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs transition ${
          selectedComponent.type === 'bullets'
            ? 'bg-brand-rust/15 text-brand-rust font-bold'
            : 'text-stone-600 hover:bg-stone-100'
        }`}
        title='Bật / Tắt danh sách đầu dòng'
      >
        <List size={14} />
      </button>

      <span className='h-4 w-px bg-stone-200' />

      {/* 7. Xoay văn bản */}
      <div className='flex items-center gap-1'>
        <button
          type='button'
          onClick={() =>
            onUpdateComponent({
              rotation: ((selectedComponent.rotation ?? 0) + 90) % 360
            })
          }
          className='flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-xs font-bold text-stone-700 hover:bg-stone-100 transition'
          title='Xoay 90° cùng chiều kim đồng hồ'
        >
          <RotateCw size={12} />
          <span className='font-mono text-[11px]'>
            {selectedComponent.rotation ?? 0}°
          </span>
        </button>
        {(selectedComponent.rotation ?? 0) !== 0 && (
          <button
            type='button'
            onClick={() => onUpdateComponent({ rotation: 0 })}
            className='flex h-7 items-center rounded-md px-1.5 text-[10px] font-semibold text-stone-500 hover:bg-stone-100 transition'
            title='Đặt lại góc xoay về 0°'
          >
            0°
          </button>
        )}
      </div>

      <span className='h-4 w-px bg-stone-200' />

      {/* 8. Nhân bản & Xóa */}
      <button
        type='button'
        onClick={() => onDuplicateComponent(selectedComponent)}
        className='flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100'
        title='Nhân bản'
      >
        <Copy size={13} />
      </button>
      <button
        type='button'
        onClick={() => onDeleteComponent(selectedComponent.id)}
        className='flex h-7 w-7 items-center justify-center rounded-md text-red-600 hover:bg-red-50'
        title='Xóa đối tượng'
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
