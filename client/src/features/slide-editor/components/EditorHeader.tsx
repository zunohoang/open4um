import {
  Check,
  Cloud,
  FileDown,
  Home,
  Loader2,
  Play,
  Redo2,
  Sparkles,
  Undo2
} from 'lucide-react'
import { useEditorStore } from '../store/editor.store'

interface EditorHeaderProps {
  title: string
  onTitleChange: (newTitle: string) => void
  onBack: () => void
  onUndo: () => void
  onRedo: () => void
  onManualSave: () => void
  onOpenExport: () => void
  onPresent: () => void
  saveStatus: 'saved' | 'saving' | 'unsaved'
  countdown: number | null
}

export const EditorHeader = ({
  title,
  onTitleChange,
  onBack,
  onUndo,
  onRedo,
  onManualSave,
  onOpenExport,
  onPresent,
  saveStatus,
  countdown
}: EditorHeaderProps) => {
  const { undoStack, redoStack, isAiPanelOpen, toggleAiPanel } =
    useEditorStore()
  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  return (
    <header className='flex h-14 w-full items-center justify-between border-b border-emerald-900/80 bg-brand-ink px-4 text-white shadow-xs select-none'>
      {/* KHU VỰC TRÁI: Logo/Back, Undo/Redo, Cloud Autosave Status */}
      <div className='flex items-center gap-2'>
        <button
          type='button'
          onClick={onBack}
          className='flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-stone-200 transition hover:bg-emerald-900/60 hover:text-white cursor-pointer'
          title='Trở về thư viện'
        >
          <Home size={15} />
          <span className='hidden sm:inline'>Thư viện</span>
        </button>

        <span className='text-emerald-800'>|</span>

        {/* Nút Undo */}
        <button
          type='button'
          onClick={onUndo}
          disabled={!canUndo}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
            canUndo
              ? 'text-stone-200 hover:bg-emerald-900/60 hover:text-white active:scale-95 cursor-pointer'
              : 'cursor-not-allowed text-emerald-800/60'
          }`}
          title='Hoàn tác (Ctrl+Z)'
        >
          <Undo2 size={16} />
        </button>

        {/* Nút Redo */}
        <button
          type='button'
          onClick={onRedo}
          disabled={!canRedo}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
            canRedo
              ? 'text-stone-200 hover:bg-emerald-900/60 hover:text-white active:scale-95 cursor-pointer'
              : 'cursor-not-allowed text-emerald-800/60'
          }`}
          title='Làm lại (Ctrl+Y)'
        >
          <Redo2 size={16} />
        </button>

        <span className='text-emerald-800'>|</span>

        {/* Trạng thái lưu đám mây */}
        <div
          onClick={saveStatus === 'unsaved' ? onManualSave : undefined}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition ${
            saveStatus === 'unsaved'
              ? 'cursor-pointer text-amber-300 hover:bg-emerald-900/60'
              : 'text-stone-400'
          }`}
          title={
            saveStatus === 'saving'
              ? 'Đang đồng bộ thay đổi lên máy chủ...'
              : saveStatus === 'unsaved'
                ? 'Có thay đổi chưa lưu. Bấm để lưu hoặc dùng Ctrl+S'
                : 'Mọi thay đổi đã được tự động lưu an toàn'
          }
        >
          {saveStatus === 'saving' ? (
            <>
              <Loader2 size={14} className='animate-spin text-amber-300' />
              <span className='hidden text-[11px] font-medium sm:inline'>
                Đang lưu...
              </span>
            </>
          ) : countdown !== null ? (
            <>
              <Cloud size={14} className='animate-pulse text-amber-300' />
              <span className='hidden text-[11px] font-medium sm:inline'>
                Lưu sau {countdown}s
              </span>
            </>
          ) : saveStatus === 'unsaved' ? (
            <>
              <Cloud size={14} className='text-amber-300' />
              <span className='hidden text-[11px] font-bold text-amber-300 sm:inline'>
                Chưa lưu (Bấm lưu)
              </span>
            </>
          ) : (
            <>
              <div className='flex items-center text-emerald-400'>
                <Cloud size={14} />
                <Check size={11} className='-ml-1' />
              </div>
              <span className='hidden text-[11px] font-medium text-stone-300 sm:inline'>
                Đã lưu
              </span>
            </>
          )}
        </div>
      </div>

      {/* KHU VỰC GIỮA: Tên bài giảng chỉnh sửa trực tiếp */}
      <div className='mx-2 flex max-w-sm flex-1 items-center justify-center sm:max-w-md'>
        <input
          type='text'
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder='Tiêu đề bài giảng...'
          className='w-full truncate rounded-md border border-transparent bg-transparent px-2.5 py-1 text-center text-xs font-semibold text-stone-100 transition hover:border-emerald-700 focus:border-brand-rust focus:bg-emerald-950/80 focus:text-white focus:outline-none'
          title='Click để đổi tên bài giảng'
        />
      </div>

      {/* KHU VỰC PHẢI: Nút AI Copilot, Xuất bản, Trình chiếu */}
      <div className='flex items-center gap-2'>
        {/* Toggle AI Copilot Panel */}
        <button
          type='button'
          onClick={toggleAiPanel}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
            isAiPanelOpen
              ? 'border border-brand-rust/50 bg-emerald-900/60 text-brand-rust'
              : 'text-stone-300 hover:bg-emerald-900/40 hover:text-white'
          }`}
          title='Bật / Tắt bảng Trợ lý AI'
        >
          <Sparkles size={14} />
          <span className='hidden md:inline'>Trợ lý AI</span>
        </button>

        {/* Nút Xuất bản */}
        <button
          type='button'
          onClick={onOpenExport}
          className='flex items-center gap-1.5 rounded-md border border-emerald-800 bg-emerald-900/60 px-3 py-1.5 text-xs font-semibold text-stone-200 shadow-2xs transition hover:bg-emerald-800 hover:text-white active:scale-95 cursor-pointer'
          title='Xuất bài giảng (PNG, PDF...)'
        >
          <FileDown size={14} />
          <span className='hidden sm:inline'>Xuất</span>
        </button>

        {/* Nút Trình chiếu theo chuẩn màu Brand Rust (#c45b3f) */}
        <button
          type='button'
          onClick={onPresent}
          className='flex items-center gap-1.5 rounded-md bg-brand-rust px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#b04f35] active:scale-95 cursor-pointer'
          title='Trình chiếu toàn màn hình (F5/Present)'
        >
          <Play size={14} />
          <span>Trình chiếu</span>
        </button>
      </div>
    </header>
  )
}
