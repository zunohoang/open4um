import { Lightbulb, Loader2, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { useEditorStore } from '../store/editor.store'

interface AiCopilotPanelProps {
  onApplyAiPrompt: (instruction: string) => Promise<void>
  isAiLoading: boolean
}

const AI_SUGGESTIONS = [
  'Rút gọn thành 3 ý chính súc tích',
  'Thêm ví dụ thực tế minh họa',
  'Viết lại với giọng điệu trang trọng',
  'Tóm tắt kết luận ngắn gọn, dễ nhớ'
]

export const AiCopilotPanel = ({
  onApplyAiPrompt,
  isAiLoading
}: AiCopilotPanelProps) => {
  const { isAiPanelOpen, toggleAiPanel, aiMessages } = useEditorStore()
  const [instruction, setInstruction] = useState('')

  if (!isAiPanelOpen) return null

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!instruction.trim() || isAiLoading) return

    const promptText = instruction.trim()
    setInstruction('')
    await onApplyAiPrompt(promptText)
  }

  return (
    <aside className='flex w-80 shrink-0 flex-col border-l border-stone-200 bg-white font-sans text-stone-800 shadow-sm'>
      {/* Header Panel */}
      <div className='flex h-12 items-center justify-between border-b border-stone-200 px-4'>
        <div className='flex items-center gap-2'>
          <Sparkles size={16} className='text-brand-rust' />
          <span className='text-xs font-bold uppercase tracking-wider text-brand-ink'>
            Trợ lý AI
          </span>
        </div>
        <button
          type='button'
          onClick={toggleAiPanel}
          className='flex h-6 w-6 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer'
          title='Đóng bảng AI'
        >
          <X size={16} />
        </button>
      </div>

      {/* Danh sách tin nhắn trao đổi (Chat history) */}
      <div className='flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar'>
        {aiMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs ${
                msg.role === 'user'
                  ? 'bg-brand-ink text-white rounded-br-xs'
                  : 'bg-stone-100 text-stone-800 border border-stone-200 rounded-bl-xs'
              }`}
            >
              <div className='whitespace-pre-wrap leading-relaxed'>
                {msg.text}
              </div>
            </div>
            <span className='mt-1 text-[9px] text-stone-400 px-1'>
              {msg.timestamp}
            </span>
          </div>
        ))}

        {isAiLoading && (
          <div className='flex items-center gap-2 rounded-xl bg-orange-50/80 p-3 text-xs text-brand-rust border border-brand-rust/30'>
            <Loader2 size={16} className='animate-spin' />
            <span className='font-medium'>
              AI đang phân tích và tinh chỉnh slide...
            </span>
          </div>
        )}

        {/* Các gợi ý lệnh nhanh */}
        <div className='pt-2'>
          <span className='block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5'>
            Gợi ý lệnh nhanh:
          </span>
          <div className='space-y-1.5'>
            {AI_SUGGESTIONS.map((sug) => (
              <button
                key={sug}
                type='button'
                onClick={() => setInstruction(sug)}
                className='flex w-full items-center gap-1.5 text-left rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] text-stone-600 transition hover:border-brand-rust hover:bg-brand-rust/5 hover:text-brand-rust cursor-pointer'
              >
                <Lightbulb size={12} className='text-amber-500 shrink-0' />
                <span>{sug}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Khung nhập Prompt vào đây ở đáy (theo đúng wireframe) */}
      <div className='border-t border-stone-200 bg-stone-50 p-3'>
        <form onSubmit={handleSubmit} className='space-y-2'>
          <label
            htmlFor='ai-prompt-input'
            className='block text-[10px] font-bold uppercase tracking-wider text-stone-600'
          >
            Prompt vào đây:
          </label>
          <textarea
            id='ai-prompt-input'
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSubmit()
              }
            }}
            placeholder='Ví dụ: Rút gọn thành 3 ý chính dễ nhớ...'
            className='w-full resize-none rounded-lg border border-stone-300 bg-white p-2.5 text-xs text-stone-900 outline-none transition focus:border-brand-rust focus:ring-1 focus:ring-brand-rust'
          />
          <button
            type='submit'
            disabled={!instruction.trim() || isAiLoading}
            className='flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-rust py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition hover:bg-[#b04f35] active:scale-95 disabled:opacity-50 cursor-pointer'
          >
            <Sparkles size={14} />
            <span>{isAiLoading ? 'Đang xử lý...' : 'Áp dụng AI'}</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
