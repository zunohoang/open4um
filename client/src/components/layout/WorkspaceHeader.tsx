import { useState, type ReactNode } from 'react'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { BrandLogo } from '@/components/ui'
import { UserAccountMenu } from '@/components/layout/UserAccountMenu'

interface WorkspaceHeaderProps {
  onCreate?: () => void
  children?: ReactNode
}

export const WorkspaceHeader = ({ children }: WorkspaceHeaderProps) => {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin'

  const [showBellToast, setShowBellToast] = useState(false)
  const [showHelpToast, setShowHelpToast] = useState(false)

  return (
    <header className='fixed top-0 left-0 right-0 z-30 flex h-16 items-center justify-between border-b border-stone-300 bg-brand-paper px-5 sm:px-12'>
      {/* Logo & Nhãn vai trò */}
      <div className='flex items-center gap-3'>
        <BrandLogo
          variant='horizontal'
          theme='light'
          height={32}
          asLink
          to={isAdmin ? '/admin' : '/library'}
        />
        {isAdmin && (
          <span className='border border-orange-300 bg-orange-100 px-2 py-0.5 font-sans text-xs font-bold text-orange-900'>
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

        <UserAccountMenu />
      </div>
    </header>
  )
}
