import {
  Check,
  Cloud,
  CloudOff,
  FileDown,
  Home,
  Loader2,
  Play,
  Redo2,
  Sparkles,
  Undo2
} from 'lucide-react'
import { useEditorStore } from '../store/editor.store'

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'offline_saved'

interface EditorHeaderProps {
  title: string
  onTitleChange: (newTitle: string) => void
  onBack: () => void
  onUndo: () => void
  onRedo: () => void
  onManualSave: () => void
  onOpenExport: () => void
  onPresent: () => void
  saveStatus: SaveStatus
  countdown: number | null
  isAutoSave: boolean
  onToggleAutoSave: () => void
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
  countdown,
  isAutoSave,
  onToggleAutoSave
}: EditorHeaderProps) => {
  const { undoStack, redoStack, isAiPanelOpen, toggleAiPanel } =
    useEditorStore()
  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  return (
    <header className='relative flex h-14 w-full items-center justify-between border-b border-emerald-900/80 bg-brand-ink px-4 text-white shadow-xs select-none'>
      {/* KHU VỰC TRÁI: Logo/Back, Undo/Redo, Autosave Toggle, Save Status */}
      <div className='relative z-10 flex shrink-0 items-center gap-2'>
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

        {/* Công tắc Bật / Tắt Tự động lưu (Autosave) */}
        <div
          className='flex items-center gap-1.5 rounded-md px-1 py-1 text-xs'
          title={
            isAutoSave
              ? 'Tự động lưu đang BẬT (tự lưu sau khi sửa). Bấm để TẮT'
              : 'Tự động lưu đang TẮT (cần ấn Lưu hoặc Ctrl+S). Bấm để BẬT'
          }
        >
          <span className='hidden text-[11px] font-medium text-stone-300 lg:inline'>
            Autosave
          </span>
          <button
            type='button'
            role='switch'
            aria-checked={isAutoSave}
            onClick={onToggleAutoSave}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isAutoSave ? 'bg-emerald-600' : 'bg-stone-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                isAutoSave ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Trạng thái lưu (Cố định chiều rộng w-[116px] để chống giật / xô lệch layout) */}
        <div className='flex w-[116px] shrink-0 items-center justify-start'>
          {saveStatus === 'saving' ? (
            <div className='flex items-center gap-1.5 px-1 py-1 text-xs text-amber-300'>
              <Loader2
                size={14}
                className='animate-spin text-amber-300 shrink-0'
              />
              <span className='hidden text-[11px] font-medium sm:inline truncate'>
                Đang lưu...
              </span>
            </div>
          ) : isAutoSave && countdown !== null ? (
            <div className='flex items-center gap-1.5 px-1 py-1 text-xs text-amber-300'>
              <Cloud
                size={14}
                className='animate-pulse text-amber-300 shrink-0'
              />
              <span className='hidden text-[11px] font-medium sm:inline truncate'>
                Lưu sau {countdown}s
              </span>
            </div>
          ) : saveStatus === 'offline_saved' ? (
            <button
              type='button'
              onClick={onManualSave}
              className='flex items-center gap-1.5 rounded-md border border-orange-500/50 bg-orange-950/60 px-2 py-1 text-xs text-orange-300 shadow-2xs transition hover:bg-orange-900/70 cursor-pointer'
              title='Đang offline. Thay đổi đã được lưu an toàn vào trình duyệt. Bấm để thử đồng bộ lại lên máy chủ.'
            >
              <CloudOff size={14} className='text-orange-400 shrink-0' />
              <span className='text-[11px] font-bold truncate'>
                Đã lưu offline
              </span>
            </button>
          ) : saveStatus === 'unsaved' ? (
            <button
              type='button'
              onClick={onManualSave}
              className='flex items-center gap-1.5 rounded-md border border-amber-400/50 bg-amber-950/60 px-2 py-1 text-xs font-bold text-amber-300 shadow-2xs transition hover:bg-amber-900/70 active:scale-95 cursor-pointer'
              title='Có thay đổi chưa lưu. Bấm để lưu hoặc nhấn Ctrl+S'
            >
              <Cloud size={14} className='shrink-0' />
              <span className='text-[11px] truncate'>
                {isAutoSave ? 'Lưu ngay' : 'Lưu (Ctrl+S)'}
              </span>
            </button>
          ) : (
            <div
              className='flex items-center gap-1.5 px-1 py-1 text-xs text-stone-300'
              title='Mọi thay đổi đã được lưu an toàn lên máy chủ'
            >
              <div className='flex items-center text-emerald-400 shrink-0'>
                <Cloud size={14} />
                <Check size={11} className='-ml-1' />
              </div>
              <span className='hidden text-[11px] font-medium sm:inline truncate'>
                Đã lưu
              </span>
            </div>
          )}
        </div>
      </div>

      {/* KHU VỰC GIỮA: Tên bài giảng căn giữa tuyệt đối (Absolute Centering) */}
      <div className='pointer-events-none absolute left-1/2 top-1/2 flex w-full max-w-[200px] -translate-x-1/2 -translate-y-1/2 items-center justify-center px-2 sm:max-w-xs md:max-w-sm lg:max-w-md'>
        <input
          type='text'
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder='Tiêu đề bài giảng...'
          className='pointer-events-auto w-full truncate rounded-md border border-transparent bg-transparent px-2.5 py-1 text-center text-xs font-semibold text-stone-100 transition hover:border-emerald-700 focus:border-brand-rust focus:bg-emerald-950/80 focus:text-white focus:outline-none'
          title='Click để đổi tên bài giảng'
        />
      </div>

      {/* KHU VỰC PHẢI: Nút AI Copilot, Xuất bản, Trình chiếu */}
      <div className='relative z-10 flex shrink-0 items-center gap-2'>
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
