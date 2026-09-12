import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store/auth.store'

export type SidebarTab = 'library' | 'trash' | 'profile' | 'admin'

interface SidebarProps {
  activeTab?: SidebarTab
  onTabChange?: (tab: SidebarTab) => void
  onCreateClick: () => void
  totalLectures?: number
}

export const Sidebar = ({
  activeTab,
  onTabChange,
  onCreateClick,
  totalLectures
}: SidebarProps) => {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin'
  const location = useLocation()
  const navigate = useNavigate()

  // Xác định tab hiện tại dựa trên route hoặc prop
  const currentTab: SidebarTab =
    activeTab ||
    (location.pathname.startsWith('/trash')
      ? 'trash'
      : location.pathname.startsWith('/profile')
        ? 'profile'
        : location.pathname.startsWith('/admin')
          ? 'admin'
          : 'library')

  const handleNav = (tab: SidebarTab, path: string) => {
    onTabChange?.(tab)
    navigate(path)
  }

  return (
    <aside className='fixed left-0 top-16 bottom-0 z-20 flex w-60 flex-col justify-between overflow-y-auto border-r border-stone-300 bg-brand-paper p-5 font-sans'>
      <div className='space-y-6'>
        {/* Nút Tạo bài giảng mới phẳng chuẩn phong cách editorial */}
        {!isAdmin && (
          <button
            type='button'
            onClick={onCreateClick}
            className='flex w-full items-center justify-center gap-2 bg-orange-700 px-4 py-3 font-sans text-xs font-bold uppercase tracking-wider text-white transition hover:bg-orange-800 active:translate-y-0.5'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 20 20'
              fill='currentColor'
              className='h-4 w-4'
            >
              <path d='M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z' />
            </svg>
            <span>Tạo bài giảng mới</span>
          </button>
        )}

        {/* Danh sách các ngăn điều hướng dạng danh mục xuất bản */}
        <nav className='space-y-1'>
          <button
            type='button'
            onClick={() => handleNav('profile', '/profile')}
            className={`flex w-full items-center justify-between border-l-2 px-3 py-2.5 text-xs transition ${
              currentTab === 'profile'
                ? 'border-orange-700 bg-stone-200/70 font-bold text-emerald-950'
                : 'border-transparent text-stone-600 hover:bg-stone-200/40 hover:text-emerald-950'
            }`}
          >
            <div className='flex items-center gap-2.5'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={1.75}
                stroke='currentColor'
                className={`h-4 w-4 ${currentTab === 'profile' ? 'text-orange-700' : 'text-stone-400'}`}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z'
                />
              </svg>
              <span>Hồ sơ cá nhân</span>
            </div>
          </button>
          {/* Ngăn 1: Thư viện bài giảng */}
          <button
            type='button'
            onClick={() => handleNav('library', '/library')}
            className={`flex w-full items-center justify-between border-l-2 px-3 py-2.5 text-xs transition ${
              currentTab === 'library'
                ? 'border-orange-700 bg-stone-200/70 font-bold text-emerald-950'
                : 'border-transparent text-stone-600 hover:bg-stone-200/40 hover:text-emerald-950'
            }`}
          >
            <div className='flex items-center gap-2.5'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={1.75}
                stroke='currentColor'
                className={`h-4 w-4 ${currentTab === 'library' ? 'text-orange-700' : 'text-stone-400'}`}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25'
                />
              </svg>
              <span>Thư viện bài giảng</span>
            </div>
            {typeof totalLectures === 'number' && (
              <span className='border border-stone-300 bg-stone-100 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-stone-700'>
                {totalLectures}
              </span>
            )}
          </button>

          {/* Ngăn 2: Thùng rác */}
          <button
            type='button'
            onClick={() => handleNav('trash', '/trash')}
            className={`flex w-full items-center justify-between border-l-2 px-3 py-2.5 text-xs transition ${
              currentTab === 'trash'
                ? 'border-orange-700 bg-stone-200/70 font-bold text-emerald-950'
                : 'border-transparent text-stone-600 hover:bg-stone-200/40 hover:text-emerald-950'
            }`}
          >
            <div className='flex items-center gap-2.5'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={1.75}
                stroke='currentColor'
                className={`h-4 w-4 ${currentTab === 'trash' ? 'text-orange-700' : 'text-stone-400'}`}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0'
                />
              </svg>
              <span>Thùng rác</span>
            </div>
          </button>

          {/* Ngăn 3: Hồ sơ cá nhân */}

          {/* Lối vào Quản trị (dành cho admin) */}
          {isAdmin && (
            <div className='pt-3 border-t border-stone-300'>
              <button
                type='button'
                onClick={() => handleNav('admin', '/admin')}
                className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-xs transition ${
                  currentTab === 'admin'
                    ? 'border-orange-700 bg-stone-200/70 font-bold text-orange-900'
                    : 'border-transparent text-stone-600 hover:bg-stone-200/40 hover:text-emerald-950'
                }`}
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                  strokeWidth={1.75}
                  stroke='currentColor'
                  className='h-4 w-4 text-orange-700'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75'
                  />
                </svg>
                <span>Quản trị hệ thống</span>
              </button>
            </div>
          )}
        </nav>
      </div>

      {/* Chân Sidenav: Thẻ Credit phong cách cổ điển */}
      {!isAdmin && (
        <div className='border border-stone-300 bg-white p-3.5'>
          <div className='flex items-center justify-between text-xs'>
            <span className='font-bold text-stone-700 uppercase tracking-wider text-[10px]'>
              Số dư Credit
            </span>
            <span className='font-bold text-orange-700 font-mono'>
              {user?.creditBalance ?? 0}
            </span>
          </div>
          <p className='mt-1 text-[11px] text-stone-500 leading-tight'>
            Tự động trừ khi AI sinh nội dung và dàn ý bài giảng.
          </p>
        </div>
      )}
    </aside>
  )
}
