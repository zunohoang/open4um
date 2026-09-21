import type { Slide } from '@/lib/types'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

export interface SlideContextMenuState {
  x: number
  y: number
  slide: Slide
  index: number
}

interface SlideContextMenuProps {
  menu: SlideContextMenuState
  canDelete: boolean
  onClose: () => void
  onAddRight: (index: number) => void
  onDuplicate: (slideId: string) => void
  onDelete: (slideId: string) => void
}

export const SlideContextMenu = ({
  menu,
  canDelete,
  onClose,
  onAddRight,
  onDuplicate,
  onDelete
}: SlideContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const deleteTooltip = canDelete
    ? 'Xóa slide này'
    : 'Bài giảng phải có ít nhất một slide'

  return (
    <div
      ref={menuRef}
      style={{
        top: Math.min(menu.y, window.innerHeight - 165),
        left: Math.min(menu.x, window.innerWidth - 200)
      }}
      className='fixed z-50 w-48 rounded-md border border-stone-300 bg-white p-1 shadow-2xl font-sans text-xs text-stone-800 animate-in fade-in zoom-in-95 duration-100 select-none'
    >
      <div className='border-b border-stone-200 px-2.5 py-1.5 font-bold text-stone-700 truncate text-[11px]'>
        Trang {menu.index + 1}: {menu.slide.title || 'Slide trống'}
      </div>

      <div className='py-1 space-y-0.5'>
        <button
          type='button'
          onClick={() => {
            onAddRight(menu.index + 1)
            onClose()
          }}
          className='flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-medium hover:bg-stone-100 hover:text-stone-900 transition rounded cursor-pointer'
        >
          <Plus size={13} className='text-stone-600' />
          <span>Thêm slide bên phải</span>
        </button>

        <button
          type='button'
          onClick={() => {
            onDuplicate(menu.slide.id)
            onClose()
          }}
          className='flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-medium hover:bg-stone-100 hover:text-stone-900 transition rounded cursor-pointer'
        >
          <Copy size={13} className='text-stone-600' />
          <span>Nhân bản slide</span>
        </button>

        <button
          type='button'
          disabled={!canDelete}
          onClick={() => {
            if (!canDelete) return
            onDelete(menu.slide.id)
            onClose()
          }}
          className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-medium rounded transition ${
            canDelete
              ? 'hover:bg-red-50 text-red-600 cursor-pointer'
              : 'text-stone-400 opacity-40 cursor-not-allowed'
          }`}
          title={deleteTooltip}
        >
          <Trash2
            size={13}
            className={canDelete ? 'text-red-600' : 'text-stone-400'}
          />
          <span>Xóa slide</span>
        </button>
      </div>
    </div>
  )
}
