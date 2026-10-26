import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'

const getInitial = (name?: string) => {
  if (!name) return 'U'
  const words = name.trim().split(/\s+/)
  const lastWord = words[words.length - 1]
  return (lastWord?.[0] || name[0] || 'U').toUpperCase()
}

export const UserAccountMenu = () => {
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const { user, refreshToken, clearSession } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const initial = getInitial(user?.name)

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const goTo = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  const logout = () => {
    setOpen(false)
    if (refreshToken) void authApi.logout(refreshToken)
    clearSession()
  }

  return (
    <div className='relative' ref={menuRef}>
      <button
        type='button'
        onClick={() => setOpen((current) => !current)}
        className='flex items-center gap-2.5 border border-stone-300 bg-white py-1.5 pl-3.5 pr-2 transition hover:border-emerald-950 focus:outline-none focus:ring-2 focus:ring-brand-rust/60'
        title='Quản lý tài khoản'
        aria-label='Mở menu tài khoản'
        aria-haspopup='menu'
        aria-expanded={open}
      >
        <span className='max-w-30 truncate font-sans text-xs font-bold text-emerald-950 sm:max-w-40'>
          {user?.name || 'Tài khoản'}
        </span>
        <div className='flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden border border-stone-300 bg-orange-700 font-sans text-xs font-bold text-white'>
          {user?.avatar ? (
            <img
              src={user.avatar}
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
                  src={user.avatar}
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
                <span className='border border-stone-300 bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-700'>
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
              <div className='flex justify-between border-b border-stone-100 pb-1.5'>
                <span>Số dư hiện tại:</span>
                <span className='font-mono font-bold text-orange-700'>
                  {user?.creditBalance ?? 0} credit
                </span>
              </div>
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

          <div className='border-t border-stone-200 pt-2.5'>
            <button
              type='button'
              role='menuitem'
              onClick={logout}
              className='flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold text-red-700 transition hover:bg-red-50 hover:text-red-800'
            >
              <span aria-hidden='true'>↪</span>
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
