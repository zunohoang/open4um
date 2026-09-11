import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { authApi } from '@/features/auth/api/auth.api'
import { PasswordInput } from '@/components/ui'

const getInitial = (name?: string) => {
  if (!name) return 'U'
  const trimmed = name.trim()
  const words = trimmed.split(/\s+/)
  const lastWord = words[words.length - 1]
  return (lastWord?.[0] || trimmed[0] || 'U').toUpperCase()
}

export const ProfilePage = () => {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  // State form cập nhật thông tin cá nhân (UC004)
  const [name, setName] = useState(user?.name || '')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileCooldown, setProfileCooldown] = useState(0)

  // Hiệu ứng đếm ngược cooldown chống spam
  useEffect(() => {
    if (profileCooldown <= 0) return
    const timer = setInterval(() => {
      setProfileCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [profileCooldown])

  // State form đổi mật khẩu (UC005)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // State cài đặt hiển thị
  const [theme, setTheme] = useState(
    localStorage.getItem('app_theme') || 'warm'
  )
  const [language, setLanguage] = useState(
    localStorage.getItem('app_lang') || 'vi'
  )
  const [autoSave, setAutoSave] = useState(
    localStorage.getItem('app_autosave') !== 'false'
  )
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null)

  // Xử lý cập nhật thông tin cá nhân
  const handleUpdateProfile = async (event: FormEvent) => {
    event.preventDefault()
    setProfileError(null)
    setProfileSuccess(null)

    const trimmedName = name.trim()
    if (!trimmedName || trimmedName.length < 2) {
      setProfileError('Họ và tên phải có ít nhất 2 ký tự')
      return
    }
    if (trimmedName === user?.name) {
      setProfileError('Tên mới trùng với tên hiện tại của bạn.')
      return
    }

    try {
      setIsSavingProfile(true)
      const updatedUser = await authApi.updateProfile({ name: trimmedName })
      updateUser({ name: updatedUser.name })
      setProfileSuccess('Đã cập nhật thông tin cá nhân thành công!')
      setProfileCooldown(60) // Cooldown 60s
      setTimeout(() => setProfileSuccess(null), 4000)
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || 'Không thể cập nhật hồ sơ, vui lòng thử lại sau.'
      setProfileError(message)

      // Nếu là lỗi 429 và thông báo có chứa số giây, tự động kích hoạt bộ đếm ngược
      const secMatch = message.match(/(\d+)\s*giây/)
      if (secMatch) {
        setProfileCooldown(parseInt(secMatch[1], 10))
      }
    } finally {
      setIsSavingProfile(false)
    }
  }

  // Xử lý đổi mật khẩu
  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (!oldPassword) {
      setPasswordError('Vui lòng nhập mật khẩu hiện tại của bạn')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp với mật khẩu mới')
      return
    }
    if (newPassword === oldPassword) {
      setPasswordError('Mật khẩu mới không được trùng với mật khẩu cũ')
      return
    }

    try {
      setIsChangingPassword(true)
      const res = await authApi.changePassword({
        oldPassword,
        newPassword,
        confirmPassword
      })
      setPasswordSuccess(res.message || 'Đổi mật khẩu thành công!')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(null), 3500)
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || 'Không thể đổi mật khẩu, vui lòng thử lại sau.'
      setPasswordError(message)
    } finally {
      setIsChangingPassword(false)
    }
  }

  // Xử lý lưu cài đặt hiển thị
  const handleSaveSettings = (event: FormEvent) => {
    event.preventDefault()
    localStorage.setItem('app_theme', theme)
    localStorage.setItem('app_lang', language)
    localStorage.setItem('app_autosave', String(autoSave))
    setSettingsSuccess('Đã lưu tùy chọn giao diện & hệ thống thành công!')
    setTimeout(() => setSettingsSuccess(null), 3000)
  }

  const initial = getInitial(user?.name)

  return (
    <div className='mx-auto max-w-5xl px-5 py-10 sm:px-12 font-sans'>
      {/* Nút quay lại thư viện */}
      <button
        type='button'
        onClick={() => navigate('/library')}
        className='mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 hover:text-orange-800 transition'
      >
        <span>←</span>
        <span>Quay lại Thư viện bài giảng</span>
      </button>

      {/* Header trang */}
      <div className='mb-8'>
        <span className='text-xs font-bold tracking-widest uppercase text-orange-700'>
          HỒ SƠ CÁ NHÂN
        </span>
        <h1 className='mt-1 font-serif text-3xl sm:text-4xl font-medium text-emerald-950'>
          Thông tin tài khoản & Bảo mật
        </h1>
        <p className='mt-2 text-sm text-stone-600'>
          Quản lý thông tin định danh, số dư credit và bảo mật tài khoản trên hệ
          thống ABSlider Studio.
        </p>
      </div>

      <div className='space-y-8'>
        {/* Khối 1: Thẻ tổng quan danh tính người dùng */}
        <section className='border border-stone-300 bg-white p-6 sm:p-8 shadow-xs'>
          <div className='flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex items-center gap-5'>
              {/* Avatar chữ cái đầu to bản */}
              <div className='flex h-16 w-16 shrink-0 items-center justify-center bg-orange-700 text-2xl font-bold text-white shadow-xs'>
                {initial}
              </div>
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                  <h2 className='truncate text-xl font-bold text-emerald-950'>
                    {user?.name || 'Chưa cập nhật tên'}
                  </h2>
                  <span className='border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800'>
                    🟢 Hoạt động
                  </span>
                  <span
                    className={`border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                      isAdmin
                        ? 'border-orange-300 bg-orange-100 text-orange-900'
                        : 'border-stone-300 bg-stone-100 text-stone-700'
                    }`}
                  >
                    {isAdmin ? 'Quản trị viên' : 'Thành viên'}
                  </span>
                </div>
                <div className='mt-1 flex items-center gap-2 text-xs text-stone-500 font-mono'>
                  <span>{user?.email}</span>
                  <span>•</span>
                  <span>Mã: #{user?.id ? user.id.slice(-6) : '------'}</span>
                </div>
              </div>
            </div>

            {/* Khối hiển thị số dư Credit */}
            <div className='border-t border-stone-200 pt-4 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0'>
              <div className='text-[10px] font-bold tracking-wider uppercase text-stone-500'>
                Số dư khả dụng
              </div>
              <div className='mt-1 flex items-baseline gap-1.5'>
                <span className='font-mono text-2xl font-black text-orange-700'>
                  {user?.creditBalance ?? 0}
                </span>
                <span className='text-xs font-bold text-stone-700'>credit</span>
              </div>
              <p className='mt-1 text-[11px] text-stone-500 max-w-xs'>
                Dùng để tự động tạo outline và sinh nội dung bài giảng AI.
              </p>
            </div>
          </div>
        </section>

        {/* Lưới 2 cột: Cập nhật thông tin & Đổi mật khẩu */}
        <div className='grid grid-cols-1 gap-8 lg:grid-cols-2'>
          {/* Khối 2: Cập nhật thông tin cá nhân (UC004) */}
          <section className='border border-stone-300 bg-white p-6 sm:p-7 shadow-xs'>
            <div className='border-b border-stone-200 pb-3'>
              <span className='text-[10px] font-bold tracking-wider uppercase text-orange-700'>
                THÔNG TIN
              </span>
              <h3 className='mt-1 text-lg font-bold text-emerald-950'>
                Cập nhật thông tin cá nhân
              </h3>
              <p className='mt-0.5 text-xs text-stone-500'>
                Thay đổi tên hiển thị trên hệ thống và các slide bài giảng.
              </p>
            </div>

            {profileSuccess && (
              <div className='mt-4 border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800'>
                ✅ {profileSuccess}
              </div>
            )}

            {profileError && (
              <div className='mt-4 border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-700'>
                ❌ {profileError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className='mt-5 space-y-4'>
              <div>
                <label
                  htmlFor='profile-name'
                  className='block text-xs font-bold uppercase tracking-wider text-stone-700'
                >
                  Họ và tên <span className='text-orange-700'>*</span>
                </label>
                <input
                  id='profile-name'
                  type='text'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='Ví dụ: Nguyễn Văn A'
                  className='mt-1.5 w-full border border-stone-300 bg-stone-50 p-3 text-sm font-medium text-stone-800 outline-orange-700 transition focus:border-orange-700 focus:bg-white'
                  required
                />
                <span className='mt-1 block text-[11px] text-stone-400'>
                  Tên sẽ được hiển thị trên thanh tiêu đề và chữ ký bài giảng.
                </span>
              </div>

              <div>
                <label
                  htmlFor='profile-email'
                  className='block text-xs font-bold uppercase tracking-wider text-stone-700'
                >
                  Địa chỉ Email
                </label>
                <div className='relative mt-1.5'>
                  <input
                    id='profile-email'
                    type='email'
                    value={user?.email || ''}
                    disabled
                    className='w-full border border-stone-200 bg-stone-100 p-3 pr-24 text-sm font-mono text-stone-500 cursor-not-allowed'
                  />
                  <span className='absolute right-2.5 top-1/2 -translate-y-1/2 border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800'>
                    Đã xác minh
                  </span>
                </div>
                <span className='mt-1 block text-[11px] text-stone-400'>
                  Email dùng làm tài khoản đăng nhập và không thể thay đổi trực
                  tiếp.
                </span>
              </div>

              <div className='pt-2'>
                <button
                  type='submit'
                  disabled={
                    isSavingProfile ||
                    profileCooldown > 0 ||
                    !name.trim() ||
                    name.trim() === user?.name ||
                    name.trim().length < 2
                  }
                  className='flex items-center justify-center gap-2 bg-emerald-950 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {isSavingProfile ? (
                    <>
                      <span className='inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent' />
                      <span>Đang lưu...</span>
                    </>
                  ) : profileCooldown > 0 ? (
                    <span>Vui lòng đợi ({profileCooldown}s)</span>
                  ) : (
                    <span>Lưu thông tin</span>
                  )}
                </button>

                <p className='mt-2.5 text-[11px] text-stone-500 leading-relaxed'>
                  🛡️ Để đảm bảo an toàn danh tính, hệ thống giới hạn tối thiểu
                  60 giây giữa các lần thay đổi và tối đa 5 lần mỗi giờ.
                </p>
              </div>
            </form>
          </section>

          {/* Khối 3: Đổi mật khẩu tài khoản (UC005) */}
          <section className='border border-stone-300 bg-white p-6 sm:p-7 shadow-xs'>
            <div className='border-b border-stone-200 pb-3'>
              <span className='text-[10px] font-bold tracking-wider uppercase text-orange-700'>
                BẢO MẬT
              </span>
              <h3 className='mt-1 text-lg font-bold text-emerald-950'>
                Đổi mật khẩu tài khoản
              </h3>
              <p className='mt-0.5 text-xs text-stone-500'>
                Bảo vệ tài khoản bằng cách sử dụng mật khẩu mạnh tối thiểu 6 ký
                tự.
              </p>
            </div>

            {passwordSuccess && (
              <div className='mt-4 border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800'>
                ✅ {passwordSuccess}
              </div>
            )}

            {passwordError && (
              <div className='mt-4 border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-700'>
                ❌ {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className='mt-5 space-y-4'>
              <div>
                <label
                  htmlFor='old-password'
                  className='block text-xs font-bold uppercase tracking-wider text-stone-700'
                >
                  Mật khẩu hiện tại <span className='text-orange-700'>*</span>
                </label>
                <PasswordInput
                  id='old-password'
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder='Nhập mật khẩu đang dùng'
                  required
                />
              </div>

              <div>
                <label
                  htmlFor='new-password'
                  className='block text-xs font-bold uppercase tracking-wider text-stone-700'
                >
                  Mật khẩu mới <span className='text-orange-700'>*</span>
                </label>
                <PasswordInput
                  id='new-password'
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder='Tối thiểu 6 ký tự'
                  required
                />
              </div>

              <div>
                <label
                  htmlFor='confirm-password'
                  className='block text-xs font-bold uppercase tracking-wider text-stone-700'
                >
                  Xác nhận mật khẩu mới{' '}
                  <span className='text-orange-700'>*</span>
                </label>
                <PasswordInput
                  id='confirm-password'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder='Nhập lại mật khẩu mới'
                  required
                />
              </div>

              <div className='pt-2'>
                <button
                  type='submit'
                  disabled={isChangingPassword}
                  className='flex items-center justify-center gap-2 bg-orange-700 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-orange-800 disabled:opacity-60'
                >
                  {isChangingPassword ? (
                    <>
                      <span className='inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent' />
                      <span>Đang cập nhật...</span>
                    </>
                  ) : (
                    <span>Cập nhật mật khẩu</span>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Khối 4: Cài đặt giao diện & Hệ thống */}
        <section className='border border-stone-300 bg-stone-50 p-6 sm:p-7'>
          <div className='border-b border-stone-200 pb-3'>
            <span className='text-[10px] font-bold tracking-wider uppercase text-orange-700'>
              HỆ THỐNG
            </span>
            <h3 className='mt-1 text-lg font-bold text-emerald-950'>
              Tùy chọn hiển thị & Trải nghiệm
            </h3>
            <p className='mt-0.5 text-xs text-stone-500'>
              Cấu hình giao diện và phương thức làm việc phù hợp với bạn.
            </p>
          </div>

          {settingsSuccess && (
            <div className='mt-4 border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800'>
              ✅ {settingsSuccess}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className='mt-5 space-y-4'>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <div>
                <label
                  htmlFor='pref-theme'
                  className='block text-xs font-bold text-stone-700 uppercase'
                >
                  Giao diện hiển thị
                </label>
                <select
                  id='pref-theme'
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className='mt-1.5 w-full border border-stone-300 bg-white p-2.5 text-xs outline-orange-700'
                >
                  <option value='warm'>
                    Tông màu ấm (Editorial Warm - Mặc định)
                  </option>
                  <option value='light'>Sáng tối giản (Minimal Light)</option>
                  <option value='dark'>Tối (Dark Mode Studio)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor='pref-lang'
                  className='block text-xs font-bold text-stone-700 uppercase'
                >
                  Ngôn ngữ giao diện
                </label>
                <select
                  id='pref-lang'
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className='mt-1.5 w-full border border-stone-300 bg-white p-2.5 text-xs outline-orange-700'
                >
                  <option value='vi'>Tiếng Việt (Vietnamese)</option>
                  <option value='en'>Tiếng Anh (English)</option>
                </select>
              </div>
            </div>

            <label className='flex items-center gap-2.5 text-xs text-stone-700 cursor-pointer select-none pt-1'>
              <input
                type='checkbox'
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className='h-4 w-4 border-stone-300 text-orange-700 focus:ring-orange-600'
              />
              <span className='font-semibold'>
                Tự động lưu nội dung bài giảng khi đang chỉnh sửa
              </span>
            </label>

            <div className='pt-2'>
              <button
                type='submit'
                className='border border-stone-300 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-stone-800 transition hover:border-emerald-950 hover:bg-stone-100'
              >
                Lưu tùy chọn
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
