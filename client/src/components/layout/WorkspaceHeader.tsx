import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuthStore } from '@/features/auth/store/auth.store'

interface WorkspaceHeaderProps {
  onCreate?: () => void
  onAdmin?: () => void
  onLogout: () => void
  children?: ReactNode
}

type TabType = 'profile' | 'settings' | 'feedback'

const getInitial = (name?: string) => {
  if (!name) return 'U'
  const trimmed = name.trim()
  const words = trimmed.split(/\s+/)
  const lastWord = words[words.length - 1]
  return (lastWord?.[0] || trimmed[0] || 'U').toUpperCase()
}

export const WorkspaceHeader = ({
  onAdmin,
  onLogout,
  children
}: WorkspaceHeaderProps) => {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin'

  const [open, setOpen] = useState(false)
  const [showBellToast, setShowBellToast] = useState(false)
  const [showHelpToast, setShowHelpToast] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Đóng box khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 2500)
  }

  const initial = getInitial(user?.name)

  return (
    <header className='fixed top-0 left-0 right-0 z-30 flex h-16 items-center justify-between border-b border-stone-300 bg-brand-paper px-5 sm:px-12'>
      {/* Logo & Nhãn vai trò */}
      <div className='flex items-center gap-3 font-sans text-lg font-extrabold tracking-widest text-emerald-950'>
        <div>
          AB<span className='text-orange-700'>SLIDER</span>
        </div>
        {isAdmin && (
          <span className='border border-orange-300 bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-900'>
            QUẢN TRỊ
          </span>
        )}
      </div>

      {/* Khu vực thao tác & Menu tài khoản */}
      <div className='flex items-center gap-3'>
        {children}

        {/* Icons */}
        {!isAdmin && (
          <div className='relative'>
            <button
              type='button'
              onClick={() => {
                setShowBellToast((prev) => !prev)
                setShowHelpToast(false)
              }}
              className='flex h-8 w-8 items-center justify-center border border-stone-300 bg-white text-stone-600 transition hover:border-emerald-950 hover:text-emerald-950'
              title='Thông báo'
              aria-label='Thông báo'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={1.75}
                stroke='currentColor'
                className='h-4 w-4'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0'
                />
              </svg>
            </button>
            {showBellToast && (
              <div className='absolute right-0 mt-2 w-64 border border-stone-300 bg-white p-4 font-sans text-xs text-stone-600 shadow-xl z-50'>
                <div className='mb-1 font-bold text-emerald-950'>
                  🔔 Thông báo
                </div>
                <p className='text-stone-500'>
                  Hiện tại bạn không có thông báo mới nào.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Icon Dấu hỏi chấm */}
        {!isAdmin && (
          <div className='relative'>
            <button
              type='button'
              onClick={() => {
                setShowHelpToast((prev) => !prev)
                setShowBellToast(false)
              }}
              className='flex h-8 w-8 items-center justify-center border border-stone-300 bg-white text-stone-600 transition hover:border-emerald-950 hover:text-emerald-950'
              title='Trợ giúp & Hướng dẫn'
              aria-label='Trợ giúp'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={1.75}
                stroke='currentColor'
                className='h-4 w-4'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z'
                />
              </svg>
            </button>
            {showHelpToast && (
              <div className='absolute right-0 mt-2 w-72 border border-stone-300 bg-white p-4 font-sans text-xs text-stone-600 shadow-xl z-50'>
                <div className='mb-1 font-bold text-emerald-950'>
                  ❓ Hướng dẫn nhanh
                </div>
                <p className='mb-2 text-stone-500 leading-relaxed'>
                  Sử dụng thanh điều hướng bên trái để tạo bài giảng mới hoặc
                  quản lý thư mục và bài thuyết trình.
                </p>
                <div className='border-t border-stone-200 pt-2 text-[11px] text-stone-400'>
                  ABSlider AI Studio • Phiên bản 0.1.0
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nút quản lý tài khoản: tên bên trái + ô tròn chữ cái đầu của tên bên phải */}
        <div className='relative' ref={menuRef}>
          <button
            type='button'
            onClick={() => setOpen((prev) => !prev)}
            className='flex items-center gap-2.5 border border-stone-300 bg-white py-1.5 pl-3.5 pr-2 transition hover:border-emerald-950'
            title='Quản lý tài khoản'
          >
            {/* Tên người dùng hiển thị bên trái */}
            <span className='max-w-30 truncate font-sans text-xs font-bold text-emerald-950 sm:max-w-40'>
              {user?.name || 'Tài khoản'}
            </span>

            {/* Ô tròn hiện chữ cái đầu của tên bên phải */}
            <div className='flex h-6 w-6 items-center justify-center bg-orange-700 font-sans text-xs font-bold text-white'>
              {initial}
            </div>

            {/* Mũi tên chỉ thị mở/đóng */}
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 20 20'
              fill='currentColor'
              className={`h-4 w-4 text-stone-400 transition-transform duration-200 ${
                open ? 'rotate-180 text-orange-700' : ''
              }`}
            >
              <path
                fillRule='evenodd'
                d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'
                clipRule='evenodd'
              />
            </svg>
          </button>

          {/* Box nhỏ bên dưới chứa các ngăn thẻ để quản lý tài khoản */}
          {open && (
            <div className='absolute right-0 mt-2 w-80 border border-stone-300 bg-white p-4 shadow-xl font-sans text-stone-800 z-50'>
              {/* Header Box: Thông tin định danh */}
              <div className='flex items-center gap-3 pb-3 border-b border-stone-200'>
                <div className='flex h-9 w-9 shrink-0 items-center justify-center bg-orange-700 font-bold text-white text-sm'>
                  {initial}
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-sm font-bold text-emerald-950'>
                    {user?.name}
                  </div>
                  <div className='truncate text-xs text-stone-500'>
                    {user?.email}
                  </div>
                  <div className='mt-1 flex items-center gap-2'>
                    <span
                      className={`border px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider ${
                        isAdmin
                          ? 'border-orange-300 bg-orange-100 text-orange-900'
                          : 'border-stone-300 bg-stone-100 text-stone-700'
                      }`}
                    >
                      {isAdmin ? 'Quản trị viên' : 'Thành viên'}
                    </span>
                    {!isAdmin && (
                      <span className='text-[11px] font-bold text-orange-700 font-mono'>
                        ⚡ {user?.creditBalance ?? 0} credit
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Thông báo thao tác (nếu có) */}
              {toastMessage && (
                <div className='my-2 border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-center text-xs font-semibold text-emerald-800'>
                  ✅ {toastMessage}
                </div>
              )}

              {isAdmin ? (
                /* Thông tin tinh gọn cho Quản trị viên */
                <div className='my-3 space-y-2.5 text-xs text-stone-600'>
                  <div className='flex justify-between border-b border-stone-100 pb-1.5'>
                    <span>Mã tài khoản:</span>
                    <span className='font-mono font-bold text-emerald-950'>
                      #{user?.id ? user.id.slice(-6) : '---'}
                    </span>
                  </div>
                  <div className='flex justify-between border-b border-stone-100 pb-1.5'>
                    <span>Quyền hạn:</span>
                    <span className='font-semibold text-orange-800'>
                      Quản trị viên
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Các ngăn thẻ chuyển đổi tab (dạng gạch chân editorial) */}
                  <div className='my-3 flex border-b border-stone-200 text-xs font-semibold'>
                    <button
                      type='button'
                      onClick={() => setActiveTab('profile')}
                      className={`flex-1 py-2 text-center transition ${
                        activeTab === 'profile'
                          ? 'border-b-2 border-orange-700 font-bold text-emerald-950'
                          : 'text-stone-500 hover:text-emerald-950'
                      }`}
                    >
                      Hồ sơ
                    </button>
                    <button
                      type='button'
                      onClick={() => setActiveTab('settings')}
                      className={`flex-1 py-2 text-center transition ${
                        activeTab === 'settings'
                          ? 'border-b-2 border-orange-700 font-bold text-emerald-950'
                          : 'text-stone-500 hover:text-emerald-950'
                      }`}
                    >
                      Cài đặt
                    </button>
                    <button
                      type='button'
                      onClick={() => setActiveTab('feedback')}
                      className={`flex-1 py-2 text-center transition ${
                        activeTab === 'feedback'
                          ? 'border-b-2 border-orange-700 font-bold text-emerald-950'
                          : 'text-stone-500 hover:text-emerald-950'
                      }`}
                    >
                      Góp ý
                    </button>
                  </div>

                  {/* Ngăn 1: Hồ sơ tài khoản */}
                  {activeTab === 'profile' && (
                    <div className='space-y-2.5 text-xs text-stone-600'>
                      <div className='flex justify-between border-b border-stone-100 pb-1.5'>
                        <span>Mã tài khoản:</span>
                        <span className='font-mono font-bold text-emerald-950'>
                          #{user?.id ? user.id.slice(-6) : '---'}
                        </span>
                      </div>
                      <div className='flex justify-between border-b border-stone-100 pb-1.5'>
                        <span>Gói thành viên:</span>
                        <span className='font-semibold text-stone-800'>
                          {isAdmin
                            ? 'Quản trị hệ thống'
                            : 'Tiêu chuẩn (AI Studio)'}
                        </span>
                      </div>
                      <div className='flex justify-between border-b border-stone-100 pb-1.5'>
                        <span>Số dư hiện tại:</span>
                        <span className='font-bold text-orange-700 font-mono'>
                          {user?.creditBalance ?? 0} credit
                        </span>
                      </div>
                      <div className='border border-stone-200 bg-stone-50 p-2.5 text-[11px] leading-relaxed text-stone-500'>
                        💡 Số dư credit dùng để tự động tạo outline và sinh nội
                        dung slide bài giảng thông minh.
                      </div>
                    </div>
                  )}

                  {/* Ngăn 2: Cài đặt (Blank inputs giữ nguyên) */}
                  {activeTab === 'settings' && (
                    <div className='space-y-3 text-xs'>
                      <div>
                        <label
                          htmlFor='theme-select'
                          className='block font-semibold text-stone-700'
                        >
                          Giao diện hiển thị
                        </label>
                        <select
                          id='theme-select'
                          className='mt-1 w-full border border-stone-300 bg-white p-2 text-xs outline-orange-700'
                          defaultValue='warm'
                        >
                          <option value='warm'>Tông màu ấm (Mặc định)</option>
                          <option value='light'>Sáng (Minimal Light)</option>
                          <option value='dark'>Tối (Dark Mode)</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor='lang-select'
                          className='block font-semibold text-stone-700'
                        >
                          Ngôn ngữ hệ thống
                        </label>
                        <select
                          id='lang-select'
                          className='mt-1 w-full border border-stone-300 bg-white p-2 text-xs outline-orange-700'
                          defaultValue='vi'
                        >
                          <option value='vi'>Tiếng Việt (Vietnamese)</option>
                          <option value='en'>Tiếng Anh (English)</option>
                        </select>
                      </div>

                      <label className='flex items-center gap-2 text-stone-700'>
                        <input
                          type='checkbox'
                          defaultChecked
                          className='border-stone-300 text-orange-700 focus:ring-orange-600'
                        />
                        <span>Tự động lưu nội dung bài giảng</span>
                      </label>

                      <button
                        type='button'
                        onClick={() =>
                          showToast('Đã lưu tùy chọn cài đặt thành công')
                        }
                        className='w-full bg-emerald-950 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-stone-900'
                      >
                        Lưu cài đặt
                      </button>
                    </div>
                  )}

                  {/* Ngăn 3: Góp ý & Báo lỗi (Blank inputs giữ nguyên) */}
                  {activeTab === 'feedback' && (
                    <div className='space-y-2.5 text-xs'>
                      <div>
                        <label
                          htmlFor='feedback-topic'
                          className='block font-semibold text-stone-700'
                        >
                          Chủ đề góp ý
                        </label>
                        <input
                          id='feedback-topic'
                          type='text'
                          placeholder='Ví dụ: Thêm mẫu bố cục slide mới...'
                          className='mt-1 w-full border border-stone-300 bg-white p-2 text-xs outline-orange-700'
                        />
                      </div>

                      <div>
                        <label
                          htmlFor='feedback-content'
                          className='block font-semibold text-stone-700'
                        >
                          Nội dung góp ý
                        </label>
                        <textarea
                          id='feedback-content'
                          rows={2}
                          placeholder='Chia sẻ phản hồi hoặc đề xuất cải tiến...'
                          className='mt-1 w-full border border-stone-300 bg-white p-2 text-xs outline-orange-700 resize-none'
                        />
                      </div>

                      <button
                        type='button'
                        onClick={() =>
                          showToast('Cảm ơn bạn đã gửi ý kiến đóng góp!')
                        }
                        className='w-full bg-orange-700 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-orange-800'
                      >
                        Gửi phản hồi
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Footer: Lối vào admin (nếu người dùng thường có link) & Nút Đăng xuất */}
              <div className='mt-3.5 space-y-1 border-t border-stone-200 pt-2.5'>
                {!isAdmin && onAdmin && (
                  <button
                    type='button'
                    onClick={() => {
                      setOpen(false)
                      onAdmin()
                    }}
                    className='flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-100 transition'
                  >
                    <span>⚙️</span>
                    <span>Trang Quản trị Hệ thống</span>
                  </button>
                )}

                <button
                  type='button'
                  onClick={() => {
                    setOpen(false)
                    onLogout()
                  }}
                  className='flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold text-red-700 hover:bg-red-50 hover:text-red-800 transition'
                >
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    fill='none'
                    viewBox='0 0 24 24'
                    strokeWidth={1.75}
                    stroke='currentColor'
                    className='h-4 w-4'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75'
                    />
                  </svg>
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
