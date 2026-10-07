import type { Slide } from '@/lib/types'
import { SlidePreview } from '@/features/library/components/SlidePreview'
import { GripVertical, MoreVertical } from 'lucide-react'
import React from 'react'

interface SlideThumbnailProps {
  slide: Slide
  index: number
  isActive: boolean
  isDragging: boolean
  dropPosition: 'before' | 'after' | null
  onSelect: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
}

export const SlideThumbnail = ({
  slide,
  index,
  isActive,
  isDragging,
  dropPosition,
  onSelect,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}: SlideThumbnailProps) => {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`group relative flex h-20 w-34 shrink-0 flex-col overflow-hidden rounded-md border transition select-none ${
        isDragging
          ? 'opacity-40 scale-95 border-dashed border-brand-rust cursor-grabbing'
          : 'cursor-grab hover:shadow-md'
      } ${
        isActive
          ? 'border-brand-rust ring-2 ring-brand-rust/50 shadow-sm'
          : 'border-stone-300 hover:border-stone-400 bg-stone-100'
      }`}
      title={`Trang ${index + 1}: ${slide.title || 'Slide trống'} (Kéo đổi thứ tự • Chuột phải tùy chọn)`}
    >
      {/* Vị trí chèn khi kéo thả */}
      {dropPosition === 'before' && (
        <div className='absolute -left-1.5 top-0 bottom-0 z-30 w-1 rounded-full bg-brand-rust shadow-md animate-pulse pointer-events-none' />
      )}
      {dropPosition === 'after' && (
        <div className='absolute -right-1.5 top-0 bottom-0 z-30 w-1 rounded-full bg-brand-rust shadow-md animate-pulse pointer-events-none' />
      )}

      {/* Slide Visual Vector Preview (Hình thu nhỏ trực quan 16:9) */}
      <div className='relative h-full w-full overflow-hidden bg-white pointer-events-none'>
        <SlidePreview slide={slide} className='h-full w-full object-cover' />
      </div>

      {/* Badge số thứ tự slide nổi ở góc trên trái */}
      <div
        className='absolute top-1 left-1 z-20 flex items-center gap-0.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow-xs backdrop-blur-xs transition group-hover:bg-black/75'
        title='Cầm kéo để đổi vị trí'
      >
        <GripVertical
          size={10}
          className='opacity-70 group-hover:opacity-100'
        />
        <span>{index + 1}</span>
      </div>

      {/* Nút tùy chọn 3 chấm nổi ở góc trên phải khi hover */}
      <div
        onClick={(e) => e.stopPropagation()}
        className='absolute top-1 right-1 z-20 opacity-0 transition group-hover:opacity-100'
      >
        <button
          type='button'
          onClick={onContextMenu}
          className='flex h-5 w-5 items-center justify-center rounded bg-black/60 text-white hover:bg-black/85 cursor-pointer transition shadow-xs backdrop-blur-xs'
          title='Tùy chọn slide'
        >
          <MoreVertical size={11} />
        </button>
      </div>

      {/* Thanh tiêu đề thu nhỏ ở chân thumbnail */}
      <div className='absolute inset-x-0 bottom-0 z-10 truncate bg-gradient-to-t from-black/70 via-black/40 to-transparent px-1.5 pt-2 pb-0.5 text-[9px] font-medium text-white shadow-xs pointer-events-none'>
        {slide.title || 'Slide trống'}
      </div>
    </div>
  )
}

