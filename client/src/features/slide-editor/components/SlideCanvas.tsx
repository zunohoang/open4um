import type { Slide, SlideComponent } from '@/lib/types'
import { Copy, Sparkles, Trash2 } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { FONT_MAP } from '../constants/theme-options'
import { getSlideComponents } from '../utils/slide'

interface SlideCanvasProps {
  slide: Slide | null | undefined
  components?: SlideComponent[]
  slideIndex: number
  totalSlides: number
  selectedCompId: string | null
  onSelectComponent: (id: string | null) => void
  onUpdateComponent: (
    id: string,
    patch: Partial<SlideComponent>,
    recordHistory?: boolean
  ) => void
  onDuplicateComponent: (comp: SlideComponent) => void
  onDeleteComponent: (id: string) => void
  onAiQuickAction: (action: 'rewrite' | 'shorten' | 'expand') => void
  isAiLoading?: boolean
}

export const SlideCanvas = ({
  slide,
  components: passedComponents,
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
  const hasRecordedHistoryRef = useRef(false)

  // Quản lý trạng thái kéo thả di chuyển hoặc co giãn phần tử
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize'
    handle?: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w'
    compId: string
    isText?: boolean
    startX: number
    startY: number
    initialX: number
    initialY: number
    initialWidth: number
    initialHeight: number
    initialFontSize: number
  } | null>(null)

  // Bắt đầu kéo di chuyển vị trí phần tử
  const handleStartMove = (e: React.MouseEvent, comp: SlideComponent) => {
    e.stopPropagation()
    onSelectComponent(comp.id)
    hasRecordedHistoryRef.current = false

    setDragState({
      type: 'move',
      compId: comp.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: comp.x,
      initialY: comp.y,
      initialWidth: comp.width ?? 50,
      initialHeight: comp.height ?? 20,
      initialFontSize: comp.fontSize ?? 20
    })
  }

  // Bắt đầu co giãn kích thước bằng các chốt neo góc và cạnh
  const handleStartResize = (
    e: React.MouseEvent,
    comp: SlideComponent,
    handle: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w'
  ) => {
    e.stopPropagation()
    onSelectComponent(comp.id)
    hasRecordedHistoryRef.current = false

    const compEl =
      (e.currentTarget.closest(
        `[data-component-id='${comp.id}']`
      ) as HTMLElement) || e.currentTarget.parentElement

    let initW = comp.width
    let initH = comp.height

    if (canvasRef.current && compEl) {
      const canvasRect = canvasRef.current.getBoundingClientRect()
      const compRect = compEl.getBoundingClientRect()
      if (canvasRect.width > 0 && canvasRect.height > 0) {
        if (!initW) {
          initW = Math.round((compRect.width / canvasRect.width) * 100)
        }
        if (!initH) {
          initH = Math.round((compRect.height / canvasRect.height) * 100)
        }
      }
    }

    const isTextComp = comp.type !== 'image' && comp.type !== 'shape'

    setDragState({
      type: 'resize',
      handle,
      compId: comp.id,
      isText: isTextComp,
      startX: e.clientX,
      startY: e.clientY,
      initialX: comp.x,
      initialY: comp.y,
      initialWidth: initW ?? 50,
      initialHeight: initH ?? 20,
      initialFontSize: comp.fontSize ?? 20
    })
  }

  // Lắng nghe sự kiện mousemove và mouseup toàn cục khi đang kéo thả
  useEffect(() => {
    if (!dragState || !canvasRef.current) return

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return

      const deltaX = e.clientX - dragState.startX
      const deltaY = e.clientY - dragState.startY

      if (!hasRecordedHistoryRef.current && Math.hypot(deltaX, deltaY) < 2) {
        return
      }

      let shouldRecord = false
      if (!hasRecordedHistoryRef.current) {
        hasRecordedHistoryRef.current = true
        shouldRecord = true
      }

      const deltaPercentX = (deltaX / rect.width) * 100
      const deltaPercentY = (deltaY / rect.height) * 100

      if (dragState.type === 'move') {
        const nextX = Math.round(
          Math.max(
            0,
            Math.min(
              100 - dragState.initialWidth,
              dragState.initialX + deltaPercentX
            )
          )
        )
        const nextY = Math.round(
          Math.max(
            0,
            Math.min(
              100 - dragState.initialHeight,
              dragState.initialY + deltaPercentY
            )
          )
        )
        onUpdateComponent(
          dragState.compId,
          { x: nextX, y: nextY },
          shouldRecord
        )
      } else if (dragState.type === 'resize' && dragState.handle) {
        const minW = 5
        const minH = 3
        const x0 = dragState.initialX
        const y0 = dragState.initialY
        const w0 = Math.max(1, dragState.initialWidth)
        const h0 = Math.max(1, dragState.initialHeight)
        const R0 = x0 + w0
        const B0 = y0 + h0
        const dx = deltaPercentX
        const dy = deltaPercentY

        let nextX = x0
        let nextY = y0
        let nextW = w0
        let nextH = h0
        let nextFontSize: number | undefined

        const isCorner =
          dragState.handle === 'nw' ||
          dragState.handle === 'ne' ||
          dragState.handle === 'se' ||
          dragState.handle === 'sw'

        if (dragState.isText && isCorner) {
          // Với block text: Kéo 4 góc sẽ scale đồng thời cả kích thước khung và font-size
          let s = 1

          switch (dragState.handle) {
            case 'se': {
              const sx = (w0 + dx) / w0
              const sy = (h0 + dy) / h0
              s = Math.abs(dx / w0) >= Math.abs(dy / h0) ? sx : sy
              s = Math.max(minW / w0, s)
              nextW = Math.min(100 - x0, w0 * s)
              s = nextW / w0
              nextH = Math.max(minH, Math.min(100 - y0, h0 * s))
              nextX = x0
              nextY = y0
              break
            }
            case 'sw': {
              const sx = (w0 - dx) / w0
              const sy = (h0 + dy) / h0
              s = Math.abs(dx / w0) >= Math.abs(dy / h0) ? sx : sy
              s = Math.max(minW / w0, s)
              nextW = Math.min(R0, w0 * s)
              s = nextW / w0
              nextH = Math.max(minH, Math.min(100 - y0, h0 * s))
              nextX = R0 - nextW
              nextY = y0
              break
            }
            case 'ne': {
              const sx = (w0 + dx) / w0
              const sy = (h0 - dy) / h0
              s = Math.abs(dx / w0) >= Math.abs(dy / h0) ? sx : sy
              s = Math.max(minW / w0, s)
              nextW = Math.min(100 - x0, w0 * s)
              s = nextW / w0
              nextH = Math.max(minH, Math.min(B0, h0 * s))
              nextX = x0
              nextY = B0 - nextH
              break
            }
            case 'nw': {
              const sx = (w0 - dx) / w0
              const sy = (h0 - dy) / h0
              s = Math.abs(dx / w0) >= Math.abs(dy / h0) ? sx : sy
              s = Math.max(minW / w0, s)
              nextW = Math.min(R0, w0 * s)
              s = nextW / w0
              nextH = Math.max(minH, Math.min(B0, h0 * s))
              nextX = R0 - nextW
              nextY = B0 - nextH
              break
            }
          }

          nextFontSize = Math.round(
            Math.max(10, Math.min(160, dragState.initialFontSize * s))
          )
        } else {
          // Các đối tượng hình khối, ảnh hoặc kéo các chốt cạnh (e, w, n, s) của text
          switch (dragState.handle) {
            case 'se':
              nextX = x0
              nextY = y0
              nextW = Math.max(minW, Math.min(100 - x0, w0 + dx))
              nextH = Math.max(minH, Math.min(100 - y0, h0 + dy))
              break

            case 'sw':
              nextX = Math.max(0, Math.min(R0 - minW, x0 + dx))
              nextW = R0 - nextX
              nextY = y0
              nextH = Math.max(minH, Math.min(100 - y0, h0 + dy))
              break

            case 'ne':
              nextX = x0
              nextW = Math.max(minW, Math.min(100 - x0, w0 + dx))
              nextY = Math.max(0, Math.min(B0 - minH, y0 + dy))
              nextH = B0 - nextY
              break

            case 'nw':
              nextX = Math.max(0, Math.min(R0 - minW, x0 + dx))
              nextW = R0 - nextX
              nextY = Math.max(0, Math.min(B0 - minH, y0 + dy))
              nextH = B0 - nextY
              break

            case 'e':
              nextX = x0
              nextY = y0
              nextW = Math.max(minW, Math.min(100 - x0, w0 + dx))
              nextH = h0
              break

            case 'w':
              nextX = Math.max(0, Math.min(R0 - minW, x0 + dx))
              nextW = R0 - nextX
              nextY = y0
              nextH = h0
              break

            case 's':
              nextX = x0
              nextY = y0
              nextW = w0
              nextH = Math.max(minH, Math.min(100 - y0, h0 + dy))
              break

            case 'n':
              nextX = x0
              nextW = w0
              nextY = Math.max(0, Math.min(B0 - minH, y0 + dy))
              nextH = B0 - nextY
              break
          }
        }

        const patch: Partial<SlideComponent> = {
          x: Math.round(nextX),
          y: Math.round(nextY),
          width: Math.round(nextW),
          height: Math.round(nextH)
        }
        if (nextFontSize !== undefined) {
          patch.fontSize = nextFontSize
        }

        onUpdateComponent(dragState.compId, patch, shouldRecord)
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

  const components =
    passedComponents ?? (slide ? getSlideComponents(slide) : [])

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
              data-component-id={comp.id}
              style={{
                position: 'absolute',
                left: `${comp.x}%`,
                top: `${comp.y}%`,
                width: comp.width ? `${comp.width}%` : 'auto',
                height:
                  isShape && comp.shapeType !== 'line'
                    ? comp.height
                      ? `${comp.height}%`
                      : 'auto'
                    : comp.type === 'image' && comp.height
                      ? `${comp.height}%`
                      : 'auto',
                minHeight:
                  isText && comp.height ? `${comp.height}%` : undefined,
                maxWidth: '100%'
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
                  {comp.shapeType === 'line' ? (
                    <>
                      <span
                        onMouseDown={(e) => handleStartResize(e, comp, 'w')}
                        className='absolute top-1/2 -left-2 z-30 h-4 w-4 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-white bg-brand-rust shadow-xs transition-transform hover:scale-125'
                        title='Kéo điểm đầu'
                      />
                      <span
                        onMouseDown={(e) => handleStartResize(e, comp, 'e')}
                        className='absolute top-1/2 -right-2 z-30 h-4 w-4 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-white bg-brand-rust shadow-xs transition-transform hover:scale-125'
                        title='Kéo điểm cuối'
                      />
                    </>
                  ) : (
                    <>
                      {/* 4 Chốt định vị co giãn ở 4 góc */}
                      <span
                        onMouseDown={(e) => handleStartResize(e, comp, 'nw')}
                        className='absolute -top-1.5 -left-1.5 z-30 h-3 w-3 cursor-nwse-resize rounded-full border-2 border-white bg-brand-rust shadow-xs transition-transform hover:scale-125'
                        title='Co giãn góc trên - trái'
                      />
                      <span
                        onMouseDown={(e) => handleStartResize(e, comp, 'ne')}
                        className='absolute -top-1.5 -right-1.5 z-30 h-3 w-3 cursor-nesw-resize rounded-full border-2 border-white bg-brand-rust shadow-xs transition-transform hover:scale-125'
                        title='Co giãn góc trên - phải'
                      />
                      <span
                        onMouseDown={(e) => handleStartResize(e, comp, 'sw')}
                        className='absolute -bottom-1.5 -left-1.5 z-30 h-3 w-3 cursor-nesw-resize rounded-full border-2 border-white bg-brand-rust shadow-xs transition-transform hover:scale-125'
                        title='Co giãn góc dưới - trái'
                      />
                      <span
                        onMouseDown={(e) => handleStartResize(e, comp, 'se')}
                        className='absolute -bottom-1.5 -right-1.5 z-30 h-3 w-3 cursor-nwse-resize rounded-full border-2 border-white bg-brand-rust shadow-xs transition-transform hover:scale-125'
                        title='Co giãn góc dưới - phải'
                      />

                      {/* Các chốt định vị co giãn ở 4 cạnh */}
                      <span
                        onMouseDown={(e) => handleStartResize(e, comp, 'w')}
                        className='absolute top-1/2 -left-1.5 z-30 h-5 w-2 -translate-y-1/2 cursor-ew-resize rounded-full border border-white bg-brand-rust shadow-xs transition-transform hover:scale-125'
                        title='Kéo giãn chiều ngang'
                      />
                      <span
                        onMouseDown={(e) => handleStartResize(e, comp, 'e')}
                        className='absolute top-1/2 -right-1.5 z-30 h-5 w-2 -translate-y-1/2 cursor-ew-resize rounded-full border border-white bg-brand-rust shadow-xs transition-transform hover:scale-125'
                        title='Kéo giãn chiều ngang'
                      />
                      <span
                        onMouseDown={(e) => handleStartResize(e, comp, 'n')}
                        className='absolute -top-1.5 left-1/2 z-30 h-2 w-5 -translate-x-1/2 cursor-ns-resize rounded-full border border-white bg-brand-rust shadow-xs transition-transform hover:scale-125'
                        title='Kéo giãn chiều dọc'
                      />
                      <span
                        onMouseDown={(e) => handleStartResize(e, comp, 's')}
                        className='absolute -bottom-1.5 left-1/2 z-30 h-2 w-5 -translate-x-1/2 cursor-ns-resize rounded-full border border-white bg-brand-rust shadow-xs transition-transform hover:scale-125'
                        title='Kéo giãn chiều dọc'
                      />
                    </>
                  )}

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
                <div className='h-full w-full overflow-hidden rounded-sm pointer-events-none'>
                  <img
                    src={comp.imageUrl || comp.content}
                    alt='Slide graphic'
                    className={
                      comp.height
                        ? 'h-full w-full object-contain'
                        : 'h-auto w-full max-h-[70vh] object-contain'
                    }
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
                  className='w-full resize-none rounded border border-brand-rust/40 bg-brand-paper/80 p-1 outline-none break-words'
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
                  className='w-full break-words'
                >
                  {comp.type === 'bullets' ? (
                    <ul className='space-y-1.5 list-disc pl-5'>
                      {comp.content
                        .split('\n')
                        .filter((s) => s.trim())
                        .map((bullet, idx) => (
                          <li key={idx} className='break-words'>
                            {bullet}
                          </li>
                        ))}
                    </ul>
                  ) : comp.type === 'quote' ? (
                    <div className='italic border-y border-stone-300 py-3 px-2 break-words'>
                      “ {comp.content} ”
                    </div>
                  ) : (
                    <div className='whitespace-pre-wrap break-words'>
                      {comp.content}
                    </div>
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
