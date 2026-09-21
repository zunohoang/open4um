import type { Slide } from '@/lib/types'
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
      className={`group relative flex h-20 w-28 shrink-0 flex-col justify-between rounded-md border bg-white p-2 shadow-xs transition select-none ${
        isDragging
          ? 'opacity-40 scale-95 border-dashed border-brand-rust cursor-grabbing'
          : 'cursor-grab hover:shadow-md'
      } ${
        isActive
          ? 'border-brand-rust ring-2 ring-brand-rust/30 font-bold'
          : 'border-stone-300 hover:border-stone-400'
      }`}
      title={`Trang ${index + 1}: ${slide.title || 'Slide trống'} (Kéo đổi thứ tự • Chuột phải tùy chọn)`}
    >
      {dropPosition === 'before' && (
        <div className='absolute -left-2 top-0 bottom-0 z-30 w-1 rounded-full bg-brand-rust shadow-md animate-pulse pointer-events-none' />
      )}
      {dropPosition === 'after' && (
        <div className='absolute -right-2 top-0 bottom-0 z-30 w-1 rounded-full bg-brand-rust shadow-md animate-pulse pointer-events-none' />
      )}

      <div className='flex items-center justify-between'>
        <div
          className='flex items-center gap-0.5 text-stone-400 group-hover:text-stone-600 transition'
          title='Cầm kéo để đổi vị trí'
        >
          <GripVertical
            size={12}
            className='cursor-grab active:cursor-grabbing text-stone-400 group-hover:text-stone-600'
          />
          <span className='font-mono text-[10px] font-bold'>{index + 1}</span>
        </div>

        <div
          onClick={(e) => e.stopPropagation()}
          className='opacity-0 transition group-hover:opacity-100'
        >
          <button
            type='button'
            onClick={onContextMenu}
            className='flex h-5 w-5 items-center justify-center rounded text-stone-500 hover:bg-stone-200 hover:text-stone-800 cursor-pointer transition'
            title='Tùy chọn slide'
          >
            <MoreVertical size={12} />
          </button>
        </div>
      </div>

      <div className='truncate text-[11px] text-stone-800 font-serif'>
        {slide.title || 'Slide trống'}
      </div>
    </div>
  )
}
