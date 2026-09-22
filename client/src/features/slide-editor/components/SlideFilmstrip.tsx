import type { Slide } from '@/lib/types'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus
} from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../store/editor.store'
import {
  SlideContextMenu,
  type SlideContextMenuState
} from './SlideContextMenu'
import { SlideThumbnail } from './SlideThumbnail'

interface SlideFilmstripProps {
  slides: Slide[]
  activeSlideIndex: number
  onSelectSlide: (index: number) => void
  onAddSlide: (atIndex?: number) => void
  onDuplicateSlide: (slideId: string) => void
  onDeleteSlide: (slideId: string) => void
  onMoveSlide: (slideId: string, toIndex: number) => void
}

export const SlideFilmstrip = ({
  slides,
  activeSlideIndex,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide
}: SlideFilmstripProps) => {
  const { isFilmstripOpen, toggleFilmstrip } = useEditorStore()
  const stripRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null)
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(
    null
  )
  const [dropTarget, setDropTarget] = useState<{
    index: number
    position: 'before' | 'after'
  } | null>(null)
  const [contextMenu, setContextMenu] = useState<SlideContextMenuState | null>(
    null
  )

  const checkScrollability = () => {
    const el = stripRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 5)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5)
  }

  useEffect(() => {
    checkScrollability()
    const el = stripRef.current
    if (!el) return

    el.addEventListener('scroll', checkScrollability)
    window.addEventListener('resize', checkScrollability)
    return () => {
      el.removeEventListener('scroll', checkScrollability)
      window.removeEventListener('resize', checkScrollability)
    }
  }, [slides.length, isFilmstripOpen])

  useEffect(() => {
    const el = stripRef.current
    const activeEl = el?.children[activeSlideIndex] as HTMLElement | undefined
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      })
    }
  }, [activeSlideIndex])

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (contextMenu) setContextMenu(null)
    const el = stripRef.current
    if (el && e.deltaY !== 0) {
      el.scrollLeft += e.deltaY
      checkScrollability()
    }
  }

  const handleScrollBy = (offset: number) => {
    if (contextMenu) setContextMenu(null)
    stripRef.current?.scrollBy({ left: offset, behavior: 'smooth' })
  }

  const handleOpenContextMenu = (
    e: React.MouseEvent,
    slide: Slide,
    index: number
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      slide,
      index
    })
  }

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    slideId: string,
    index: number
  ) => {
    setContextMenu(null)
    e.dataTransfer.setData('text/plain', slideId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedSlideId(slideId)
    setDraggedSlideIndex(index)
  }

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    index: number
  ) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const target = e.currentTarget
    const rect = target.getBoundingClientRect()
    const position: 'before' | 'after' =
      e.clientX - rect.left > rect.width / 2 ? 'after' : 'before'

    if (dropTarget?.index !== index || dropTarget?.position !== position) {
      setDropTarget({ index, position })
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault()
    if (draggedSlideIndex === null || !draggedSlideId) {
      handleDragEnd()
      return
    }

    const position = dropTarget?.position ?? 'before'
    const rawTarget = position === 'before' ? index : index + 1
    const toIndex = draggedSlideIndex < rawTarget ? rawTarget - 1 : rawTarget

    if (
      toIndex !== draggedSlideIndex &&
      toIndex >= 0 &&
      toIndex < slides.length
    ) {
      onMoveSlide(draggedSlideId, toIndex)
    }

    handleDragEnd()
  }

  const handleDragEnd = () => {
    setDraggedSlideId(null)
    setDraggedSlideIndex(null)
    setDropTarget(null)
  }

  return (
    <footer className='w-full shrink-0 overflow-hidden border-t border-stone-300 bg-brand-paper/95 font-sans select-none'>
      <div className='flex h-10 items-center justify-between px-4 text-[11px] text-stone-500'>
        <div className='flex items-center gap-3'>
          <button
            type='button'
            onClick={toggleFilmstrip}
            className='flex items-center gap-1.5 font-semibold text-stone-700 hover:text-brand-rust transition cursor-pointer'
            title={isFilmstripOpen ? 'Thu nhỏ dải slide' : 'Mở rộng dải slide'}
          >
            {isFilmstripOpen ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronUp size={14} />
            )}
            <span>{isFilmstripOpen ? 'Ẩn dải slide' : 'Hiện dải slide'}</span>
          </button>

          {isFilmstripOpen && (
            <span className='hidden text-[10px] text-stone-400 sm:inline'>
              (Kéo thả đổi thứ tự • Chuột phải để nhân bản / xóa • Lăn chuột để
              cuộn)
            </span>
          )}
        </div>

        <div className='flex items-center gap-2'>
          {isFilmstripOpen && (
            <div className='flex items-center gap-1'>
              <button
                type='button'
                onClick={() => handleScrollBy(-280)}
                disabled={!canScrollLeft}
                className={`flex h-5 w-5 items-center justify-center rounded border border-stone-300 bg-white text-xs font-bold transition ${
                  canScrollLeft
                    ? 'text-stone-700 hover:border-brand-rust hover:text-brand-rust cursor-pointer'
                    : 'cursor-not-allowed opacity-30'
                }`}
                title='Trượt sang trái'
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type='button'
                onClick={() => handleScrollBy(280)}
                disabled={!canScrollRight}
                className={`flex h-5 w-5 items-center justify-center rounded border border-stone-300 bg-white text-xs font-bold transition ${
                  canScrollRight
                    ? 'text-stone-700 hover:border-brand-rust hover:text-brand-rust cursor-pointer'
                    : 'cursor-not-allowed opacity-30'
                }`}
                title='Trượt sang phải'
              >
                <ChevronRight size={13} />
              </button>
            </div>
          )}

          <div className='font-mono font-medium'>
            Trang {activeSlideIndex + 1} / {slides.length}
          </div>
        </div>
      </div>

      {isFilmstripOpen && (
        <div className='relative w-full overflow-hidden px-2 pb-2'>
          <div
            ref={stripRef}
            onWheel={handleWheel}
            onDragLeave={() => setDropTarget(null)}
            className='flex h-26 items-center gap-3 overflow-x-auto px-2 pb-2 scroll-smooth custom-scrollbar'
          >
            {slides.map((slide, index) => (
              <SlideThumbnail
                key={slide.id}
                slide={slide}
                index={index}
                isActive={index === activeSlideIndex}
                isDragging={draggedSlideId === slide.id}
                dropPosition={
                  dropTarget?.index === index ? dropTarget.position : null
                }
                onSelect={() => onSelectSlide(index)}
                onContextMenu={(e) => handleOpenContextMenu(e, slide, index)}
                onDragStart={(e) => handleDragStart(e, slide.id, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              />
            ))}

            <button
              type='button'
              onClick={() => onAddSlide(slides.length)}
              className='flex h-20 w-28 shrink-0 flex-col items-center justify-center rounded-md border border-dashed border-stone-400 bg-stone-50 text-stone-600 transition hover:border-brand-rust hover:bg-brand-rust/5 hover:text-brand-rust cursor-pointer'
              title='Thêm slide mới vào cuối bài giảng'
            >
              <Plus size={20} className='font-bold' />
              <span className='mt-1 text-[10px] font-semibold uppercase tracking-wider'>
                Thêm slide
              </span>
            </button>
          </div>
        </div>
      )}

      {contextMenu && (
        <SlideContextMenu
          menu={contextMenu}
          canDelete={slides.length > 1}
          onClose={() => setContextMenu(null)}
          onAddRight={(idx) => onAddSlide(idx)}
          onDuplicate={(id) => onDuplicateSlide(id)}
          onDelete={(id) => onDeleteSlide(id)}
        />
      )}
    </footer>
  )
}
