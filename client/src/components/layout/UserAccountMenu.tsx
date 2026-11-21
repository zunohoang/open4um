import { mediaUrl } from '@/lib/mediaUrl'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogoutConfirm } from '@/features/auth/hooks/useLogoutConfirm'
import { useAuthStore } from '@/features/auth/store/auth.store'

const getInitial = (name?: string) => {
  if (!name) return 'U'
  const trimmed = name.trim()
  const words = trimmed.split(/\s+/)
  const lastWord = words[words.length - 1]
  return (lastWord?.[0] || trimmed[0] || 'U').toUpperCase()
}

export const UserAccountMenu = () => {
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const user = useAuthStore((state) => state.user)
  const { requestLogout, logoutDialog } = useLogoutConfirm()
  const isAdmin = user?.role === 'admin'
  const initial = getInitial(user?.name)

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const goTo = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  const logout = () => {
    setOpen(false)
    requestLogout()
  }

  return (
    <div className='relative' ref={menuRef}>
      <button
        type='button'
        onClick={() => setOpen((current) => !current)}
        className='flex items-center gap-2.5 border border-stone-300 bg-white py-1.5 pl-3.5 pr-2 transition hover:border-emerald-950'
        title='Quản lý tài khoản'
        aria-label='Mở menu tài khoản'
        aria-haspopup='menu'
        aria-expanded={open}
      >
        <span
          data-account-name
          className='max-w-30 truncate font-sans text-xs font-bold text-emerald-950 sm:max-w-40'
        >
          {user?.name || 'Tài khoản'}
        </span>
        <div className='flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden border border-stone-300 bg-orange-700 font-sans text-xs font-bold text-white'>
          {user?.avatar ? (
            <img
              src={mediaUrl(user.avatar)}
              alt={user.name || 'Ảnh đại diện'}
              className='h-full w-full object-cover'
            />
          ) : (
            initial
          )}
        </div>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 20 20'
          fill='currentColor'
          className={`h-4 w-4 text-stone-400 transition-transform duration-200 ${
            open ? 'rotate-180 text-orange-700' : ''
          }`}
          aria-hidden='true'
        >
          <path
            fillRule='evenodd'
            d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'
            clipRule='evenodd'
          />
        </svg>
      </button>

      {open && (
        <div
          role='menu'
          className='absolute right-0 z-50 mt-2 w-80 border border-stone-300 bg-white p-4 font-sans text-stone-800 shadow-xl'
        >
          <div className='flex items-center gap-3 border-b border-stone-200 pb-3'>
            <div className='flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border border-stone-300 bg-orange-700 text-sm font-bold text-white'>
              {user?.avatar ? (
                <img
                  src={mediaUrl(user.avatar)}
                  alt={user.name || 'Ảnh đại diện'}
                  className='h-full w-full object-cover'
                />
              ) : (
                initial
              )}
            </div>
            <div className='min-w-0 flex-1'>
              <div className='truncate text-sm font-bold text-emerald-950'>
                {user?.name || 'Tài khoản'}
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
                  <span className='font-mono text-[11px] font-bold text-orange-700'>
                    ⚡ {user?.creditBalance ?? 0} credit
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className='my-3 space-y-2.5 text-xs text-stone-600'>
            <div className='flex justify-between border-b border-stone-100 pb-1.5'>
              <span>Mã tài khoản:</span>
              <span className='font-mono font-bold text-emerald-950'>
                #{user?.id ? user.id.slice(-6) : '---'}
              </span>
            </div>
            {!isAdmin && (
              <>
                <div className='flex justify-between border-b border-stone-100 pb-1.5'>
                  <span>Số dư hiện tại:</span>
                  <span className='font-mono font-bold text-orange-700'>
                    {user?.creditBalance ?? 0} credit
                  </span>
                </div>
                <div className='border border-stone-200 bg-stone-50 p-2.5 text-[11px] leading-relaxed text-stone-500'>
                  💡 Số dư credit dùng để tự động tạo outline và sinh nội dung
                  slide bài giảng thông minh.
                </div>
              </>
            )}
            <div className='space-y-1.5 pt-1'>
              <button
                type='button'
                role='menuitem'
                onClick={() => goTo('/profile')}
                className='flex w-full items-center justify-center gap-1.5 border border-stone-300 bg-white py-2 text-xs font-bold text-orange-700 transition hover:border-orange-700 hover:bg-orange-50'
              >
                Quản lý hồ sơ cá nhân <span>→</span>
              </button>
              <button
                type='button'
                role='menuitem'
                onClick={() => goTo('/change-password')}
                className='flex w-full items-center justify-center border border-stone-200 bg-stone-50 py-2 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:bg-white'
              >
                Đổi mật khẩu tài khoản
              </button>
            </div>
          </div>

          <div className='mt-3.5 space-y-1 border-t border-stone-200 pt-2.5'>
            <button
              type='button'
              role='menuitem'
              onClick={logout}
              className='flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold text-red-700 transition hover:bg-red-50 hover:text-red-800'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={1.75}
                stroke='currentColor'
                className='h-4 w-4'
                aria-hidden='true'
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
      {logoutDialog}
    </div>
  )
}
