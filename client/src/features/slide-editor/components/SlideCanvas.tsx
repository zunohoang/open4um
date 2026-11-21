import { SlideImage } from '@/features/slide-editor/components/SlideImage'
import { slideLength } from '@/features/slide-editor/utils/slide'
import type { Slide, SlideComponent, TextSelection } from '@/lib/types'
import { Check, Copy, RotateCw, Sparkles, Trash2 } from 'lucide-react'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FONT_MAP, getThemeById } from '../constants/theme-options'
import { getSlideComponents } from '../utils/slide'
import { createFrameScheduler } from '../utils/frameScheduler'
import { SlideText } from './SlideText'

interface SlideCanvasProps {
  slide: Slide | null | undefined
  originalSlide?: Slide | null
  components?: SlideComponent[]
  themeId?: string
  slideIndex: number
  totalSlides: number
  selectedCompId: string | null
  onSelectComponent: (id: string | null) => void
  onUpdateComponent: (
    id: string,
    patch: Partial<SlideComponent>,
    recordHistory?: boolean
  ) => boolean | void
  onDuplicateComponent: (comp: SlideComponent) => void
  onDeleteComponent: (id: string, recordHistory?: boolean) => void
  selection: TextSelection | null
  onTextSelection: (selection: TextSelection | null) => void
  onAiQuickAction: (action: 'rewrite' | 'shorten' | 'expand') => void
  isAiLoading?: boolean
  isPreview?: boolean
  onAcceptPreview?: () => void
  onExitPreview?: () => void
}

const SNAP_THRESHOLD = 1.5

// SRS UC012 bước 5: hút mép trái/giữa/phải của đối tượng về mép và tâm slide (đơn vị %)
const snapAxis = (start: number, size: number) => {
  for (const target of [0, 50, 100]) {
    for (const offset of [0, size / 2, size]) {
      if (Math.abs(start + offset - target) <= SNAP_THRESHOLD) {
        return { value: target - offset, guide: target }
      }
    }
  }
  return { value: start, guide: null }
}

export const SlideCanvas = ({
  slide,
  originalSlide,
  components: passedComponents,
  themeId,
  slideIndex,
  totalSlides,
  selectedCompId,
  onSelectComponent,
  onUpdateComponent,
  onDuplicateComponent,
  onDeleteComponent,
  selection,
  onTextSelection,
  onAiQuickAction,
  isAiLoading = false,
  isPreview = false,
  onAcceptPreview,
  onExitPreview
}: SlideCanvasProps) => {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'proposed' | 'original'>(
    'proposed'
  )
  const hasRecordedHistoryRef = useRef(false)

  // Tự động chuyển về bản đề xuất khi slide đề xuất thay đổi
  useEffect(() => {
    setPreviewMode('proposed')
  }, [slide?.id])

  // Quản lý gõ tiếng Việt (IME composition), phiên sửa văn bản (Session-based Undo) và auto-expand
  const isComposingRef = useRef(false)
  const isTextSessionRecordedRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Tự động co giãn chiều cao theo nội dung thực tế (scrollHeight) khi vào chế độ soạn thảo
  useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [editingTextId, slide])

  // Khi thoát chế độ sửa chữ hoặc đổi sang component khác, reset trạng thái phiên gõ
  useEffect(() => {
    isTextSessionRecordedRef.current = false
    isComposingRef.current = false
  }, [editingTextId])

  const [snapGuides, setSnapGuides] = useState<{
    v: number | null
    h: number | null
  } | null>(null)

  // Quản lý trạng thái kéo thả di chuyển, co giãn hoặc xoay phần tử
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize' | 'rotate'
    handle?: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w' | 'rotate'
    compId: string
    isText?: boolean
    startX: number
    startY: number
    initialX: number
    initialY: number
    initialWidth: number
    initialHeight: number
    initialFontSize: number
    initialRotation: number
    centerX: number
    centerY: number
  } | null>(null)

  // Bắt đầu kéo di chuyển vị trí phần tử
  const handleStartMove = (e: React.MouseEvent, comp: SlideComponent) => {
    // Không di chuyển nếu đang trong chế độ soạn thảo văn bản
    if (editingTextId === comp.id) return

    e.stopPropagation()
    onSelectComponent(comp.id)
    hasRecordedHistoryRef.current = false

    const element = e.currentTarget as HTMLElement
    const canvas = canvasRef.current
    const measuredWidth = canvas?.clientWidth
      ? (element.offsetWidth / canvas.clientWidth) * 100
      : 50
    const measuredHeight = canvas?.clientHeight
      ? (element.offsetHeight / canvas.clientHeight) * 100
      : 5

    setDragState({
      type: 'move',
      compId: comp.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: comp.x,
      initialY: comp.y,
      initialWidth: comp.width ?? measuredWidth,
      initialHeight: comp.height ?? measuredHeight,
      initialFontSize: comp.fontSize ?? 20,
      initialRotation: comp.rotation ?? 0,
      centerX: 0,
      centerY: 0
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
      const compRect = {
        width: compEl.offsetWidth,
        height: compEl.offsetHeight
      }
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
      initialFontSize: comp.fontSize ?? 20,
      initialRotation: comp.rotation ?? 0,
      centerX: 0,
      centerY: 0
    })
  }

  // Bắt đầu kéo xoay góc đối tượng
  const handleStartRotate = (e: React.MouseEvent, comp: SlideComponent) => {
    e.stopPropagation()
    onSelectComponent(comp.id)
    hasRecordedHistoryRef.current = false

    const compEl =
      (e.currentTarget.closest(
        `[data-component-id='${comp.id}']`
      ) as HTMLElement) || e.currentTarget.parentElement
    if (!compEl) return

    const rect = compEl.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    setDragState({
      type: 'rotate',
      handle: 'rotate',
      compId: comp.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: comp.x,
      initialY: comp.y,
      initialWidth: comp.width ?? 50,
      initialHeight: comp.height ?? 20,
      initialFontSize: comp.fontSize ?? 20,
      initialRotation: comp.rotation ?? 0,
      centerX,
      centerY
    })
  }

  // Lắng nghe sự kiện mousemove và mouseup toàn cục khi đang kéo thả
  useEffect(() => {
    if (!dragState || !canvasRef.current) return

    let rect = canvasRef.current.getBoundingClientRect()
    const updateBounds = () => {
      if (canvasRef.current) rect = canvasRef.current.getBoundingClientRect()
    }
    const observer = new ResizeObserver(updateBounds)
    observer.observe(canvasRef.current)

    const handleMouseMove = (e: MouseEvent) => {
      if (rect.width === 0 || rect.height === 0) return

      const deltaX = e.clientX - dragState.startX
      const deltaY = e.clientY - dragState.startY

      if (!hasRecordedHistoryRef.current && Math.hypot(deltaX, deltaY) < 2) {
        return
      }

      const updateComponent = (patch: Partial<SlideComponent>) => {
        const changed = onUpdateComponent(
          dragState.compId,
          patch,
          !hasRecordedHistoryRef.current
        )
        if (changed !== false) hasRecordedHistoryRef.current = true
      }

      const deltaPercentX = (deltaX / rect.width) * 100
      const deltaPercentY = (deltaY / rect.height) * 100

      if (dragState.type === 'rotate') {
        const currentAngle =
          (Math.atan2(
            e.clientY - dragState.centerY,
            e.clientX - dragState.centerX
          ) *
            180) /
          Math.PI
        const startAngle =
          (Math.atan2(
            dragState.startY - dragState.centerY,
            dragState.startX - dragState.centerX
          ) *
            180) /
          Math.PI
        const deltaAngle = currentAngle - startAngle

        let nextRotation = (dragState.initialRotation + deltaAngle) % 360
        if (nextRotation < 0) nextRotation += 360

        let finalRotation = Math.round(nextRotation)
        if (e.shiftKey) {
          // Giữ Shift để snap theo bước 15 độ
          finalRotation = Math.round(finalRotation / 15) * 15
        } else {
          // Tự động snap nhẹ khi gần các góc chuẩn (0, 45, 90, 135, 180, 225, 270, 315, 360)
          const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360]
          for (const snap of snapAngles) {
            if (Math.abs(finalRotation - snap) <= 3) {
              finalRotation = snap === 360 ? 0 : snap
              break
            }
          }
        }
        if (finalRotation >= 360) finalRotation = 0

        updateComponent({ rotation: finalRotation })
      } else if (dragState.type === 'move') {
        const rawX = Math.round(
          Math.max(
            0,
            Math.min(
              100 - dragState.initialWidth,
              dragState.initialX + deltaPercentX
            )
          )
        )
        const rawY = Math.round(
          Math.max(
            0,
            Math.min(
              100 - dragState.initialHeight,
              dragState.initialY + deltaPercentY
            )
          )
        )
        const snapX = snapAxis(rawX, dragState.initialWidth)
        const snapY = snapAxis(rawY, dragState.initialHeight)
        setSnapGuides((previous) =>
          previous?.v === snapX.guide && previous?.h === snapY.guide
            ? previous
            : { v: snapX.guide, h: snapY.guide }
        )
        updateComponent({ x: snapX.value, y: snapY.value })
      } else if (dragState.type === 'resize' && dragState.handle) {
        const radians = (dragState.initialRotation * Math.PI) / 180
        const cos = Math.cos(radians),
          sin = Math.sin(radians)
        const dx = ((cos * deltaX + sin * deltaY) * 100) / rect.width
        const dy = ((-sin * deltaX + cos * deltaY) * 100) / rect.height
        const edge = dragState.handle
        const horizontal = edge.includes('e') ? 1 : edge.includes('w') ? -1 : 0
        const vertical = edge.includes('s') ? 1 : edge.includes('n') ? -1 : 0
        const {
          initialWidth: w,
          initialHeight: h,
          initialX: x,
          initialY: y
        } = dragState
        const scaleText = !!(dragState.isText && horizontal && vertical)
        let width = Math.max(5, w + horizontal * dx)
        let height = Math.max(3, h + vertical * dy)
        if (scaleText) {
          const scale = Math.max(
            5 / w,
            3 / h,
            Math.abs(dx / w) >= Math.abs(dy / h) ? width / w : height / h
          )
          width = w * scale
          height = h * scale
        }
        // Keep the opposite handle stationary in screen coordinates.
        const dw = width - w,
          dh = height - h
        const shiftX =
          (horizontal * dw * cos -
            (vertical * dh * sin * rect.height) / rect.width -
            dw) /
          2
        const shiftY =
          ((horizontal * dw * sin * rect.width) / rect.height +
            vertical * dh * cos -
            dh) /
          2
        let fraction = 1
        const limit = (margin: number, movement: number) => {
          if (movement > 0)
            fraction = Math.min(fraction, Math.max(0, margin) / movement)
        }
        limit(x, -shiftX)
        limit(y, -shiftY)
        limit(100 - x - w, shiftX + dw)
        limit(100 - y - h, shiftY + dh)
        const patch: Partial<SlideComponent> = {
          x: x + shiftX * fraction,
          y: y + shiftY * fraction,
          width: w + dw * fraction,
          height: h + dh * fraction
        }
        if (scaleText)
          patch.fontSize = Math.max(
            8,
            Math.min(
              120,
              Math.round(dragState.initialFontSize * (1 + (dw * fraction) / w))
            )
          )

        updateComponent(patch)
      }
    }

    const scheduler = createFrameScheduler(handleMouseMove)
    const scheduleMove = (event: MouseEvent) => scheduler.schedule(event)
    const handleMouseUp = () => {
      scheduler.flush()
      setDragState(null)
      setSnapGuides(null)
    }

    window.addEventListener('mousemove', scheduleMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('scroll', updateBounds, true)
    window.addEventListener('resize', updateBounds)
    return () => {
      scheduler.cancel()
      observer.disconnect()
      window.removeEventListener('mousemove', scheduleMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('scroll', updateBounds, true)
      window.removeEventListener('resize', updateBounds)
    }
  }, [dragState, onUpdateComponent])

  const isViewingOriginal =
    isPreview && Boolean(originalSlide) && previewMode === 'original'
  const activeSlideData =
    isViewingOriginal && originalSlide ? originalSlide : slide
  const theme = getThemeById(activeSlideData?.theme || themeId)
  const components: SlideComponent[] =
    isViewingOriginal && originalSlide
      ? getSlideComponents(originalSlide, theme.id)
      : (passedComponents ?? (slide ? getSlideComponents(slide, theme.id) : []))

  const getRenderTextColor = (comp: SlideComponent) =>
    comp.color?.trim() || theme.textPrimary

  // Helper render hình khối
  const renderShapeElement = (comp: SlideComponent) => {
    const shapeType = comp.shapeType || 'rectangle'
    const fill =
      comp.fillColor === 'transparent'
        ? 'transparent'
        : comp.fillColor || theme.cardBackground
    const stroke = comp.borderColor || theme.cardBorder
    const strokeW = comp.borderWidth ?? 0
    const radius = comp.borderRadius ?? 0

    switch (shapeType) {
      case 'circle':
        return (
          <div
            className='h-full w-full'
            style={{
              backgroundColor: fill,
              border:
                strokeW > 0
                  ? `${slideLength(strokeW)} solid ${stroke}`
                  : 'none',
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
              height: slideLength(Math.max(2, strokeW || 2)),
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
              border:
                strokeW > 0
                  ? `${slideLength(strokeW)} solid ${stroke}`
                  : 'none',
              borderRadius: slideLength(radius || 16)
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
              border:
                strokeW > 0
                  ? `${slideLength(strokeW)} solid ${stroke}`
                  : 'none',
              borderRadius: slideLength(radius)
            }}
          />
        )
    }
  }

  return (
    <div
      className='relative flex flex-1 items-center justify-center p-2 sm:p-4 lg:p-6 overflow-hidden'
      onClick={() => {
        onSelectComponent(null)
        setEditingTextId(null)
      }}
    >
      {/* Khung Canvas tỷ lệ chuẩn 16:9 phong cách Canva */}
      <div
        ref={canvasRef}
        style={{
          backgroundColor: activeSlideData?.backgroundColor || theme.background,
          color: theme.textPrimary,
          containerType: 'inline-size'
        }}
        className={`relative aspect-video w-full max-w-4xl overflow-hidden rounded-md border shadow-xl select-none transition-all ${
          isPreview
            ? 'border-amber-400 ring-4 ring-amber-400/40 shadow-amber-500/20'
            : theme.isDark
              ? 'border-slate-800'
              : 'border-stone-200'
        }`}
      >
        {snapGuides?.v != null && (
          <div
            className='pointer-events-none absolute inset-y-0 z-30 w-px bg-pink-500'
            style={{ left: `${snapGuides.v}%` }}
          />
        )}
        {snapGuides?.h != null && (
          <div
            className='pointer-events-none absolute inset-x-0 z-30 h-px bg-pink-500'
            style={{ top: `${snapGuides.h}%` }}
          />
        )}

        {/* Banner chế độ xem trước đề xuất AI với nút gạt Before / After */}
        {isPreview && (
          <div className='absolute inset-x-0 top-0 z-40 flex items-center justify-between bg-amber-500/95 backdrop-blur-xs px-3.5 py-1.5 text-white shadow-md'>
            <div className='flex items-center gap-3'>
              <div className='flex items-center gap-1.5 text-xs font-bold'>
                <Sparkles size={14} className='animate-pulse' />
                <span className='hidden sm:inline'>
                  {originalSlide
                    ? `Slide ${(slideIndex ?? 0) + 1}:`
                    : 'Slide mới tạo từ AI'}
                </span>
              </div>

              {/* Nút gạt chuyển đổi Before / After xem thay đổi trực quan */}
              {originalSlide && (
                <div className='flex items-center rounded-lg bg-black/25 p-0.5 text-[11px] font-semibold'>
                  <button
                    type='button'
                    onClick={() => setPreviewMode('original')}
                    className={`rounded-md px-2.5 py-1 transition cursor-pointer ${
                      previewMode === 'original'
                        ? 'bg-white text-stone-900 shadow-xs font-bold'
                        : 'text-white/80 hover:text-white'
                    }`}
                    title='Xem slide hiện tại (trước khi AI chỉnh sửa)'
                  >
                    Bản hiện tại
                  </button>
                  <button
                    type='button'
                    onClick={() => setPreviewMode('proposed')}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition cursor-pointer ${
                      previewMode === 'proposed'
                        ? 'bg-amber-600 text-white shadow-xs font-bold'
                        : 'text-white/80 hover:text-white'
                    }`}
                    title='Xem đề xuất mới từ AI'
                  >
                    <Sparkles size={11} />
                    <span>Bản AI đề xuất</span>
                  </button>
                </div>
              )}
            </div>

            <div className='flex items-center gap-2'>
              {onExitPreview && (
                <button
                  type='button'
                  onClick={onExitPreview}
                  className='rounded bg-black/20 px-2.5 py-1 text-[11px] font-medium hover:bg-black/30 transition cursor-pointer'
                >
                  Thoát xem trước
                </button>
              )}
              {onAcceptPreview && (
                <button
                  type='button'
                  onClick={onAcceptPreview}
                  className='flex items-center gap-1 rounded bg-white px-3 py-1 text-[11px] font-bold text-amber-900 shadow-xs hover:bg-amber-50 transition cursor-pointer'
                >
                  <Check size={12} strokeWidth={2.5} />
                  <span>
                    {originalSlide
                      ? 'Áp dụng đề xuất'
                      : 'Chèn slide vào bài giảng'}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chỉ số slide góc trên */}
        <span
          className={`absolute right-4 z-10 font-mono text-xs font-semibold pointer-events-none ${
            isPreview ? 'top-10' : 'top-3'
          } ${theme.isDark ? 'text-slate-500' : 'text-stone-400'}`}
        >
          {totalSlides ? slideIndex + 1 : 0} / {totalSlides}
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
                maxWidth: '100%',
                transform: comp.rotation
                  ? `rotate(${comp.rotation}deg)`
                  : undefined,
                transformOrigin: 'center center'
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
                  ? 'ring-2 ring-brand-rust ring-offset-2 ring-offset-white'
                  : 'hover:ring-1 hover:ring-brand-rust/50'
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

                  {/* CHỐT XOAY ĐỐI TƯỢNG PHONG CÁCH CANVA */}
                  <div
                    onMouseDown={(e) => handleStartRotate(e, comp)}
                    className={`absolute left-1/2 -translate-x-1/2 z-30 flex items-center justify-center cursor-grab active:cursor-grabbing group/rot select-none ${
                      comp.y < 8 ? '-top-9' : '-bottom-9'
                    }`}
                    title='Kéo để xoay đối tượng (Giữ Shift để snap 15°)'
                  >
                    <div
                      className={`absolute left-1/2 h-3 w-px -translate-x-1/2 bg-brand-rust pointer-events-none ${
                        comp.y < 8 ? '-bottom-3' : '-top-3'
                      }`}
                    />
                    <div className='flex h-6 w-6 items-center justify-center rounded-full border-2 border-brand-rust bg-white text-brand-rust shadow-md transition-transform hover:scale-110 active:scale-95'>
                      <RotateCw
                        size={12}
                        style={{
                          transform: `rotate(-${comp.rotation || 0}deg)`
                        }}
                        className='transition-transform group-hover/rot:rotate-45'
                      />
                    </div>
                    {dragState?.type === 'rotate' &&
                      dragState.compId === comp.id && (
                        <div
                          className={`absolute left-1/2 rounded bg-stone-900/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-md select-none whitespace-nowrap pointer-events-none ${
                            comp.y < 8 ? '-top-6' : '-bottom-6'
                          }`}
                          style={{
                            transform: `translateX(-50%) rotate(-${comp.rotation || 0}deg)`,
                            transformOrigin: 'center center'
                          }}
                        >
                          {comp.rotation ?? 0}°
                        </div>
                      )}
                  </div>

                  {/* MINI-ACTION PILL NỔI TRÊN ĐẦU ĐỐI TƯỢNG (GIỮ NGUYÊN CHIỀU NGANG THẲNG ĐỨNG KHI XOAY PHẦN TỬ) */}
                  <div
                    data-selection-tools
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`absolute left-1/2 flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 shadow-lg backdrop-blur-xs select-none whitespace-nowrap z-40 ${
                      comp.y < 8 ? 'top-full mt-3.5' : 'bottom-full mb-3.5'
                    }`}
                    style={{
                      transform: `translateX(-50%) rotate(-${comp.rotation || 0}deg)`,
                      transformOrigin: 'center center'
                    }}
                  >
                    {isText && selection?.componentId === comp.id && (
                      <>
                        <button
                          type='button'
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onAiQuickAction('rewrite')}
                          disabled={isAiLoading}
                          className='flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-brand-rust hover:bg-brand-rust/10 transition disabled:opacity-50 whitespace-nowrap shrink-0'
                          title='Yêu cầu AI viết lại ý văn'
                        >
                          <Sparkles size={11} />
                          <span>Viết lại</span>
                        </button>
                        <span className='text-stone-300'>|</span>
                        <button
                          type='button'
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onAiQuickAction('shorten')}
                          disabled={isAiLoading}
                          className='rounded-full px-2 py-0.5 text-[11px] font-bold text-stone-700 hover:bg-stone-100 transition disabled:opacity-50 whitespace-nowrap shrink-0'
                          title='Yêu cầu AI rút gọn súc tích'
                        >
                          Rút gọn
                        </button>
                        <span className='text-stone-300'>|</span>
                        <button
                          type='button'
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onAiQuickAction('expand')}
                          disabled={isAiLoading}
                          className='rounded-full px-2 py-0.5 text-[11px] font-bold text-stone-700 hover:bg-stone-100 transition disabled:opacity-50 whitespace-nowrap shrink-0'
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
                      className='flex items-center justify-center rounded-full p-1 text-stone-600 hover:bg-stone-100 shrink-0'
                      title='Nhân bản'
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type='button'
                      onClick={() => onDeleteComponent(comp.id)}
                      className='flex items-center justify-center rounded-full p-1 text-red-600 hover:bg-red-50 shrink-0'
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
                  <SlideImage component={comp} />
                </div>
              ) : editingTextId === comp.id ? (
                /* Chế độ sửa văn bản trực tiếp khi double-click */
                <textarea
                  ref={textareaRef}
                  data-slide-canvas-text='true'
                  onSelect={(e) => {
                    const { selectionStart: start, selectionEnd: end } =
                      e.currentTarget
                    onTextSelection(
                      slide && end > start
                        ? {
                            slideId: slide.id,
                            componentId: comp.id,
                            start,
                            end
                          }
                        : null
                    )
                  }}
                  autoFocus
                  value={comp.content}
                  onMouseDown={(e) => e.stopPropagation()}
                  onCompositionStart={() => {
                    isComposingRef.current = true
                  }}
                  onCompositionEnd={() => {
                    isComposingRef.current = false
                  }}
                  onChange={(e) => {
                    const nextVal = e.target.value
                    // Cập nhật chiều cao textarea tự động nở theo nội dung thực tế
                    e.currentTarget.style.height = 'auto'
                    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`

                    if (!isTextSessionRecordedRef.current) {
                      // Ký tự đầu tiên của phiên gõ: Lưu snapshot trước khi sửa vào undoStack
                      onUpdateComponent(comp.id, { content: nextVal }, true)
                      isTextSessionRecordedRef.current = true
                    } else {
                      // Các ký tự tiếp theo trong cùng phiên: Cập nhật component nhưng không tạo thêm snapshot
                      onUpdateComponent(comp.id, { content: nextVal }, false)
                    }
                  }}
                  onKeyDown={(e) => {
                    // Nếu đang trong quá trình gõ tiếng Việt có dấu (IME), không chặn phím
                    if (
                      e.nativeEvent.isComposing ||
                      (e as unknown as { keyCode: number }).keyCode === 229
                    ) {
                      return
                    }
                    // Phím Escape: kết thúc sửa văn bản
                    if (e.key === 'Escape') {
                      e.currentTarget.blur()
                      return
                    }
                    // Nếu bấm Undo hoặc Redo trong lúc soạn thảo, reset phiên gõ để snapshot sau đó hoạt động chuẩn
                    if (
                      (e.ctrlKey || e.metaKey) &&
                      (e.key.toLowerCase() === 'z' ||
                        e.key.toLowerCase() === 'y')
                    ) {
                      isTextSessionRecordedRef.current = false
                    }
                  }}
                  onBlur={(e) => {
                    const hadTextChanges = isTextSessionRecordedRef.current
                    isTextSessionRecordedRef.current = false
                    isComposingRef.current = false
                    setEditingTextId(null)
                    // TC-18: Tự động xóa phần tử khỏi mảng components khi người dùng xóa hết nội dung và blur
                    if (!comp.content.trim() || !e.target.value.trim()) {
                      onDeleteComponent(comp.id, !hadTextChanges)
                    }
                  }}
                  style={{
                    fontSize: slideLength(comp.fontSize ?? 20),
                    fontWeight: comp.fontWeight ?? 'normal',
                    fontStyle: comp.fontStyle ?? 'normal',
                    textDecoration: comp.textFormats?.length
                      ? 'none'
                      : (comp.textDecoration ?? 'none'),
                    textAlign: comp.textAlign ?? 'left',
                    color: getRenderTextColor(comp),
                    fontFamily:
                      FONT_MAP[comp.fontFamily || 'sans'] ||
                      comp.fontFamily ||
                      'inherit',
                    textTransform:
                      comp.textCase === 'uppercase' ? 'uppercase' : 'none',
                    lineHeight: 1.3,
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere'
                  }}
                  className='w-full resize-none overflow-hidden rounded border border-brand-rust/40 bg-brand-paper/80 p-1 outline-none break-words'
                />
              ) : (
                /* Hiển thị văn bản bình thường */
                <div
                  style={{
                    fontSize: slideLength(comp.fontSize ?? 20),
                    fontWeight: comp.fontWeight ?? 'normal',
                    fontStyle: comp.fontStyle ?? 'normal',
                    textDecoration: comp.textFormats?.length
                      ? 'none'
                      : (comp.textDecoration ?? 'none'),
                    textAlign: comp.textAlign ?? 'left',
                    color: getRenderTextColor(comp),
                    fontFamily:
                      FONT_MAP[comp.fontFamily || 'sans'] ||
                      comp.fontFamily ||
                      'inherit',
                    textTransform:
                      comp.textCase === 'uppercase' ? 'uppercase' : 'none',
                    lineHeight: 1.3,
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere'
                  }}
                  className='w-full select-none break-words'
                >
                  <SlideText
                    component={comp}
                    selection={
                      selection?.componentId === comp.id ? selection : null
                    }
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
