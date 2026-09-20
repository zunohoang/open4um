import type { Slide, SlideComponent } from '@/lib/types'
import { Copy, Sparkles, Trash2 } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { FONT_MAP } from '../constants/theme-options'

interface SlideCanvasProps {
  slide: Slide | null | undefined
  slideIndex: number
  totalSlides: number
  selectedCompId: string | null
  onSelectComponent: (id: string | null) => void
  onUpdateComponent: (id: string, patch: Partial<SlideComponent>) => void
  onDuplicateComponent: (comp: SlideComponent) => void
  onDeleteComponent: (id: string) => void
  onAiQuickAction: (action: 'rewrite' | 'shorten' | 'expand') => void
  isAiLoading?: boolean
}

export const SlideCanvas = ({
  slide,
  slideIndex,
  totalSlides,
  selectedCompId,
  onSelectComponent,
  onUpdateComponent,
  onDuplicateComponent,
  onDeleteComponent,
  onAiQuickAction,
  isAiLoading = false
}: SlideCanvasProps) => {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)

  // Quản lý trạng thái kéo thả di chuyển hoặc co giãn phần tử
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize'
    compId: string
    startX: number
    startY: number
    initialX: number
    initialY: number
    initialWidth: number
    initialHeight?: number
  } | null>(null)

  // Bắt đầu kéo di chuyển vị trí phần tử
  const handleStartMove = (e: React.MouseEvent, comp: SlideComponent) => {
    e.stopPropagation()
    onSelectComponent(comp.id)

    setDragState({
      type: 'move',
      compId: comp.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: comp.x,
      initialY: comp.y,
      initialWidth: comp.width ?? 50,
      initialHeight: comp.height ?? 30
    })
  }

  // Bắt đầu co giãn kích thước bằng 4 chốt góc
  const handleStartResize = (e: React.MouseEvent, comp: SlideComponent) => {
    e.stopPropagation()
    onSelectComponent(comp.id)

    setDragState({
      type: 'resize',
      compId: comp.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: comp.x,
      initialY: comp.y,
      initialWidth: comp.width ?? 50,
      initialHeight: comp.height ?? 30
    })
  }

  // Lắng nghe sự kiện mousemove và mouseup toàn cục khi đang kéo thả
  useEffect(() => {
    if (!dragState || !canvasRef.current) return

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()

      const deltaX = e.clientX - dragState.startX
      const deltaY = e.clientY - dragState.startY

      const deltaPercentX = (deltaX / rect.width) * 100
      const deltaPercentY = (deltaY / rect.height) * 100

      if (dragState.type === 'move') {
        const nextX = Math.round(
          Math.max(1, Math.min(88, dragState.initialX + deltaPercentX))
        )
        const nextY = Math.round(
          Math.max(1, Math.min(88, dragState.initialY + deltaPercentY))
        )
        onUpdateComponent(dragState.compId, { x: nextX, y: nextY })
      } else if (dragState.type === 'resize') {
        const nextWidth = Math.round(
          Math.max(5, Math.min(96, dragState.initialWidth + deltaPercentX))
        )
        const patch: Partial<SlideComponent> = { width: nextWidth }
        if (dragState.initialHeight !== undefined) {
          const nextHeight = Math.round(
            Math.max(3, Math.min(96, dragState.initialHeight + deltaPercentY))
          )
          patch.height = nextHeight
        }
        onUpdateComponent(dragState.compId, patch)
      }
    }

    const handleMouseUp = () => {
      setDragState(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState, onUpdateComponent])

  const components = slide?.components || []

  // Helper render hình khối
  const renderShapeElement = (comp: SlideComponent) => {
    const shapeType = comp.shapeType || 'rectangle'
    const fill =
      comp.fillColor === 'transparent'
        ? 'transparent'
        : comp.fillColor || '#c45b3f'
    const stroke = comp.borderColor || '#173c39'
    const strokeW = comp.borderWidth ?? 0
    const radius = comp.borderRadius ?? 0

    switch (shapeType) {
      case 'circle':
        return (
          <div
            className='h-full w-full'
            style={{
              backgroundColor: fill,
              border: strokeW > 0 ? `${strokeW}px solid ${stroke}` : 'none',
              borderRadius: '9999px'
            }}
          />
        )
      case 'triangle':
        return (
          <svg
            viewBox='0 0 100 100'
            preserveAspectRatio='none'
            className='h-full w-full'
          >
            <polygon
              points='50,5 98,95 2,95'
              fill={fill}
              stroke={strokeW > 0 ? stroke : 'none'}
              strokeWidth={strokeW}
            />
          </svg>
        )
      case 'star':
        return (
          <svg
            viewBox='0 0 100 100'
            preserveAspectRatio='none'
            className='h-full w-full'
          >
            <polygon
              points='50,5 63,38 98,40 70,62 80,96 50,75 20,96 30,62 2,40 37,38'
              fill={fill}
              stroke={strokeW > 0 ? stroke : 'none'}
              strokeWidth={strokeW}
            />
          </svg>
        )
      case 'line':
        return (
          <div
            className='w-full'
            style={{
              height: `${Math.max(2, strokeW || 2)}px`,
              backgroundColor: stroke || fill
            }}
          />
        )
      case 'rounded-rect':
        return (
          <div
            className='h-full w-full'
            style={{
              backgroundColor: fill,
              border: strokeW > 0 ? `${strokeW}px solid ${stroke}` : 'none',
              borderRadius: `${radius || 16}px`
            }}
          />
        )
      case 'rectangle':
      case 'square':
      default:
        return (
          <div
            className='h-full w-full'
            style={{
              backgroundColor: fill,
              border: strokeW > 0 ? `${strokeW}px solid ${stroke}` : 'none',
              borderRadius: `${radius}px`
            }}
          />
        )
    }
  }

  return (
    <div
      className='relative flex flex-1 items-center justify-center p-6 overflow-hidden'
      onClick={() => {
        onSelectComponent(null)
        setEditingTextId(null)
      }}
    >
      {/* Khung Canvas tỷ lệ chuẩn 16:9 phong cách Canva */}
      <div
        ref={canvasRef}
        className='relative aspect-video w-full max-w-4xl overflow-hidden rounded-md border border-stone-200 bg-white text-stone-900 shadow-xl select-none'
      >
        {/* Chỉ số slide góc trên */}
        <span className='absolute right-4 top-3 z-10 font-mono text-xs font-semibold text-stone-400 pointer-events-none'>
          {slideIndex + 1} / {totalSlides}
        </span>

        {/* Render các components trên Canvas */}
        {components.map((comp) => {
          const isSelected = selectedCompId === comp.id
          const isText = comp.type !== 'image' && comp.type !== 'shape'
          const isShape = comp.type === 'shape'

          return (
            <div
              key={comp.id}
              style={{
                position: 'absolute',
                left: `${comp.x}%`,
                top: `${comp.y}%`,
                width: comp.width ? `${comp.width}%` : 'auto',
                height:
                  isShape && comp.shapeType !== 'line' && comp.height
                    ? `${comp.height}%`
                    : 'auto',
                maxWidth: '96%'
              }}
              onMouseDown={(e) => handleStartMove(e, comp)}
              onClick={(e) => {
                e.stopPropagation()
                onSelectComponent(comp.id)
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (isText) setEditingTextId(comp.id)
              }}
              className={`group/comp cursor-move transition-shadow ${
                isSelected
                  ? 'ring-2 ring-brand-rust ring-offset-2 ring-offset-white z-30'
                  : 'hover:ring-1 hover:ring-brand-rust/50 z-20'
              }`}
            >
              {/* KHUNG BOUNDING BOX VÀ CÁC NÚT ĐIỀU KHIỂN CANVA KHI ĐƯỢC CHỌN */}
              {isSelected && (
                <>
                  {/* 4 Chốt định vị co giãn ở 4 góc */}
                  <span
                    onMouseDown={(e) => handleStartResize(e, comp)}
                    className='absolute -top-1.5 -left-1.5 h-3 w-3 cursor-nwse-resize rounded-full border-2 border-white bg-brand-rust shadow-xs'
                    title='Kéo để co giãn kích thước'
                  />
                  <span
                    onMouseDown={(e) => handleStartResize(e, comp)}
                    className='absolute -top-1.5 -right-1.5 h-3 w-3 cursor-nesw-resize rounded-full border-2 border-white bg-brand-rust shadow-xs'
                    title='Kéo để co giãn kích thước'
                  />
                  <span
                    onMouseDown={(e) => handleStartResize(e, comp)}
                    className='absolute -bottom-1.5 -left-1.5 h-3 w-3 cursor-nesw-resize rounded-full border-2 border-white bg-brand-rust shadow-xs'
                    title='Kéo để co giãn kích thước'
                  />
                  <span
                    onMouseDown={(e) => handleStartResize(e, comp)}
                    className='absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-full border-2 border-white bg-brand-rust shadow-xs'
                    title='Kéo để co giãn kích thước'
                  />

                  {/* MINI-ACTION PILL NỔI TRÊN ĐẦU ĐỐI TƯỢNG */}
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    className='absolute -top-10 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-1 shadow-lg backdrop-blur-xs select-none'
                  >
                    {isText && (
                      <>
                        <button
                          type='button'
                          onClick={() => onAiQuickAction('rewrite')}
                          disabled={isAiLoading}
                          className='flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-brand-rust hover:bg-brand-rust/10 transition disabled:opacity-50'
                          title='Yêu cầu AI viết lại ý văn'
                        >
                          <Sparkles size={11} />
                          <span>Viết lại</span>
                        </button>
                        <span className='text-stone-300'>|</span>
                        <button
                          type='button'
                          onClick={() => onAiQuickAction('shorten')}
                          disabled={isAiLoading}
                          className='rounded-full px-2 py-0.5 text-[11px] font-bold text-stone-700 hover:bg-stone-100 transition disabled:opacity-50'
                          title='Yêu cầu AI rút gọn súc tích'
                        >
                          Rút gọn
                        </button>
                        <span className='text-stone-300'>|</span>
                        <button
                          type='button'
                          onClick={() => onAiQuickAction('expand')}
                          disabled={isAiLoading}
                          className='rounded-full px-2 py-0.5 text-[11px] font-bold text-stone-700 hover:bg-stone-100 transition disabled:opacity-50'
                          title='Yêu cầu AI mở rộng chi tiết'
                        >
                          Mở rộng
                        </button>
                        <span className='text-stone-300'>|</span>
                      </>
                    )}

                    <button
                      type='button'
                      onClick={() => onDuplicateComponent(comp)}
                      className='flex items-center justify-center rounded-full p-1 text-stone-600 hover:bg-stone-100'
                      title='Nhân bản'
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type='button'
                      onClick={() => onDeleteComponent(comp.id)}
                      className='flex items-center justify-center rounded-full p-1 text-red-600 hover:bg-red-50'
                      title='Xóa'
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}

              {/* NỘI DUNG PHẦN TỬ (HÌNH KHỐI, HÌNH ẢNH HOẶC VĂN BẢN) */}
              {comp.type === 'shape' ? (
                <div className='h-full w-full pointer-events-none'>
                  {renderShapeElement(comp)}
                </div>
              ) : comp.type === 'image' ? (
                <div className='overflow-hidden rounded-sm pointer-events-none'>
                  <img
                    src={comp.imageUrl || comp.content}
                    alt='Slide graphic'
                    className='h-auto w-full max-h-[70vh] object-contain'
                  />
                </div>
              ) : editingTextId === comp.id ? (
                /* Chế độ sửa văn bản trực tiếp khi double-click */
                <textarea
                  autoFocus
                  value={comp.content}
                  onChange={(e) =>
                    onUpdateComponent(comp.id, { content: e.target.value })
                  }
                  onBlur={() => setEditingTextId(null)}
                  style={{
                    fontSize: `${comp.fontSize ?? 20}px`,
                    fontWeight: comp.fontWeight ?? 'normal',
                    fontStyle: comp.fontStyle ?? 'normal',
                    textAlign: comp.textAlign ?? 'left',
                    color: comp.color || '#173c39',
                    fontFamily:
                      FONT_MAP[comp.fontFamily || 'sans'] ||
                      comp.fontFamily ||
                      'inherit',
                    textTransform:
                      comp.textCase === 'uppercase' ? 'uppercase' : 'none'
                  }}
                  className='w-full resize-none rounded border border-brand-rust/40 bg-brand-paper/80 p-1 outline-none'
                  rows={comp.content.split('\n').length || 2}
                />
              ) : (
                /* Hiển thị văn bản bình thường */
                <div
                  style={{
                    fontSize: `${comp.fontSize ?? 20}px`,
                    fontWeight: comp.fontWeight ?? 'normal',
                    fontStyle: comp.fontStyle ?? 'normal',
                    textDecoration: comp.textDecoration ?? 'none',
                    textAlign: comp.textAlign ?? 'left',
                    color: comp.color || '#173c39',
                    fontFamily:
                      FONT_MAP[comp.fontFamily || 'sans'] ||
                      comp.fontFamily ||
                      'inherit',
                    textTransform:
                      comp.textCase === 'uppercase' ? 'uppercase' : 'none',
                    lineHeight: 1.3
                  }}
                  className='w-full'
                >
                  {comp.type === 'bullets' ? (
                    <ul className='space-y-1.5 list-disc pl-5'>
                      {comp.content
                        .split('\n')
                        .filter((s) => s.trim())
                        .map((bullet, idx) => (
                          <li key={idx}>{bullet}</li>
                        ))}
                    </ul>
                  ) : comp.type === 'quote' ? (
                    <div className='italic border-y border-stone-300 py-3 px-2'>
                      “ {comp.content} ”
                    </div>
                  ) : (
                    <div className='whitespace-pre-wrap'>{comp.content}</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
