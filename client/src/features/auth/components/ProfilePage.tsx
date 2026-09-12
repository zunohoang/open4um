import {
  useState,
  useEffect,
  useRef,
  type FormEvent,
  type ChangeEvent
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { authApi } from '@/features/auth/api/auth.api'

// Định dạng ảnh hợp lệ và kích thước tối đa 2MB theo luồng 5a
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
]
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024 // 2MB

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

  const fileInputRef = useRef<HTMLInputElement>(null)

  // STT 2: Truy vấn và hiển thị thông tin hồ sơ
  const [name, setName] = useState(user?.name || '')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user?.avatar || null
  )
  const [hasNewAvatar, setHasNewAvatar] = useState(false)
  const [selectedFileError, setSelectedFileError] = useState<string | null>(
    null
  )

  // Trạng thái lưu hồ sơ (UC004)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  // State cài đặt giao diện
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

  // STT 2: Tải dữ liệu hồ sơ mới nhất từ CSDL khi mở trang
  useEffect(() => {
    let isMounted = true
    const fetchLatestProfile = async () => {
      try {
        const latest = await authApi.profile()
        if (isMounted) {
          updateUser(latest)
          setName(latest.name)
          setAvatarPreview(latest.avatar || null)
        }
      } catch {
        // Nếu lỗi mạng, sử dụng dữ liệu sẵn có từ auth store
      }
    }
    void fetchLatestProfile()
    return () => {
      isMounted = false
    }
  }, [updateUser])

  // Hiệu ứng đếm ngược cooldown chống spam
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // STT 3 & 5a: Xử lý chọn tệp ảnh đại diện mới và kiểm tra dung lượng / định dạng
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSelectedFileError(null)
    setErrorMessage(null)
    const file = e.target.files?.[0]
    if (!file) return

    // 5a: Kiểm tra định dạng tệp tin ảnh
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      const err =
        'Ảnh vượt quá dung lượng cho phép hoặc sai định dạng tệp tin (chỉ chấp nhận JPG, PNG, WEBP, GIF).'
      setSelectedFileError(err)
      setErrorMessage(err)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // 5a: Kiểm tra kích thước tệp tin ảnh (tối đa 2MB)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const err =
        'Ảnh vượt quá dung lượng cho phép (tối đa 2MB) hoặc sai định dạng tệp tin.'
      setSelectedFileError(err)
      setErrorMessage(err)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Đọc file thành data URL để hiển thị preview ngay lập tức
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarPreview(reader.result as string)
      setHasNewAvatar(true)
      setSelectedFileError(null)
    }
    reader.readAsDataURL(file)
  }

  // Gỡ hoặc khôi phục ảnh đại diện
  const handleRemoveAvatar = () => {
    setAvatarPreview(null)
    setHasNewAvatar(true)
    setSelectedFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Khôi phục lại ảnh ban đầu
  const handleResetAvatar = () => {
    setAvatarPreview(user?.avatar || null)
    setHasNewAvatar(false)
    setSelectedFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // STT 4, 5, 6, 7: Nhấn nút "Lưu thay đổi", kiểm tra tính hợp lệ và cập nhật vào CSDL
  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    // STT 5b: Trường Họ tên bị bỏ trống -> Thông báo "Họ tên không được để trống"
    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMessage('Họ tên không được để trống')
      return
    }

    // STT 5a: Nếu đang có lỗi tệp tin chưa giải quyết
    if (selectedFileError) {
      setErrorMessage(selectedFileError)
      return
    }

    // Kiểm tra có thay đổi dữ liệu hay không
    const nameChanged = trimmedName !== user?.name
    const avatarChanged =
      hasNewAvatar && avatarPreview !== (user?.avatar || null)

    if (!nameChanged && !avatarChanged) {
      setErrorMessage('Bạn chưa thay đổi thông tin họ tên hoặc ảnh đại diện.')
      return
    }

    try {
      setIsSaving(true)
      // STT 6: Cập nhật thông tin mới vào cơ sở dữ liệu
      const updatedUser = await authApi.updateProfile({
        name: trimmedName,
        avatar: avatarChanged ? avatarPreview : undefined
      })

      // STT 7: Tải lại giao diện và thông báo "Cập nhật hồ sơ thành công"
      updateUser(updatedUser)
      setName(updatedUser.name)
      setAvatarPreview(updatedUser.avatar || null)
      setHasNewAvatar(false)
      setSuccessMessage('Cập nhật hồ sơ thành công')
      setCooldown(60) // Cooldown 60s
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ||
        'Không thể cập nhật hồ sơ, vui lòng kiểm tra lại thông tin.'
      setErrorMessage(message)

      // Bắt bộ đếm nếu lỗi 429
      const secMatch = message.match(/(\d+)\s*giây/)
      if (secMatch) {
        setCooldown(parseInt(secMatch[1], 10))
      }
    } finally {
      setIsSaving(false)
    }
  }

  // Lưu tùy chọn hiển thị
  const handleSaveSettings = (e: FormEvent) => {
    e.preventDefault()
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
          Quản lý hồ sơ
        </h1>
        <p className='mt-2 text-sm text-stone-600'>
          Truy vấn, hiển thị và cập nhật thông tin cá nhân của bạn trên hệ thống
          ABSlider AI Studio.
        </p>
      </div>

      <div className='space-y-8'>
        {/* STT 2: Thẻ tổng quan danh tính hiển thị Họ tên, Email, Ảnh đại diện, Credit AI */}
        <section className='border border-stone-300 bg-white p-6 sm:p-8 shadow-xs'>
          <div className='flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex items-center gap-5'>
              {/* Ảnh đại diện tổng quan */}
              <div className='relative h-16 w-16 shrink-0 overflow-hidden border border-stone-300 bg-orange-700 text-2xl font-bold text-white shadow-xs flex items-center justify-center'>
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className='h-full w-full object-cover'
                  />
                ) : (
                  <span>{initial}</span>
                )}
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

            {/* STT 2: Khối hiển thị Credit AI */}
            <div className='border-t border-stone-200 pt-4 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0'>
              <div className='text-[10px] font-bold tracking-wider uppercase text-stone-500'>
                Credit AI khả dụng
              </div>
              <div className='mt-1 flex items-baseline gap-1.5'>
                <span className='font-mono text-2xl font-black text-orange-700'>
                  {user?.creditBalance ?? 0}
                </span>
                <span className='text-xs font-bold text-stone-700'>credit</span>
              </div>
              <p className='mt-1 text-[11px] text-stone-500 max-w-xs'>
                Dùng để tự động sinh dàn ý, bài giảng và chỉnh sửa slide thông
                minh.
              </p>
            </div>
          </div>
        </section>

        {/* Lưới 2 cột: Form Cập nhật hồ sơ (UC004) & Thẻ Bảo mật tài khoản */}
        <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
          {/* Cột 1 & 2: Form Quản lý hồ sơ chính (UC004) */}
          <div className='lg:col-span-2'>
            <section className='border border-stone-300 bg-white p-6 sm:p-7 shadow-xs h-full flex flex-col justify-between'>
              <div>
                <div className='border-b border-stone-200 pb-3'>
                  <span className='text-[10px] font-bold tracking-wider uppercase text-orange-700'>
                    THÔNG TIN CÁ NHÂN
                  </span>
                  <h3 className='mt-1 text-lg font-bold text-emerald-950'>
                    Chỉnh sửa Họ tên & Ảnh đại diện
                  </h3>
                  <p className='mt-0.5 text-xs text-stone-500'>
                    Cập nhật thông tin nhận diện tài khoản và hiển thị trên toàn
                    hệ thống.
                  </p>
                </div>

                {/* STT 7: Thông báo cập nhật thành công */}
                {successMessage && (
                  <div className='mt-4 flex items-center gap-2 border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800'>
                    <span>✅</span>
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Luồng thay thế 5a & 5b: Thông báo lỗi hợp lệ */}
                {errorMessage && (
                  <div className='mt-4 flex items-center gap-2 border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-700'>
                    <span>❌</span>
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* STT 3: Form thay đổi họ tên và ảnh đại diện */}
                <form
                  id='profile-form'
                  onSubmit={handleSaveProfile}
                  className='mt-5 space-y-6'
                >
                  {/* STT 2 & 3: Khu vực Ảnh đại diện */}
                  <div>
                    <label className='block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2'>
                      Ảnh đại diện
                    </label>
                    <div className='flex flex-col sm:flex-row sm:items-center gap-5'>
                      {/* Khung xem trước Avatar */}
                      <div className='relative h-20 w-20 shrink-0 overflow-hidden border-2 border-dashed border-stone-300 bg-stone-100 flex items-center justify-center text-2xl font-bold text-stone-600 shadow-xs'>
                        {avatarPreview ? (
                          <img
                            src={avatarPreview}
                            alt='Xem trước ảnh đại diện'
                            className='h-full w-full object-cover'
                          />
                        ) : (
                          <span className='text-orange-700 font-serif'>
                            {initial}
                          </span>
                        )}
                        {hasNewAvatar && (
                          <span className='absolute bottom-0 inset-x-0 bg-emerald-900/80 py-0.5 text-center text-[9px] font-bold text-white uppercase tracking-wider'>
                            Mới
                          </span>
                        )}
                      </div>

                      {/* Nút hành động chọn tệp ảnh */}
                      <div className='space-y-2'>
                        <input
                          ref={fileInputRef}
                          type='file'
                          accept='.jpg,.jpeg,.png,.webp,.gif'
                          onChange={handleFileChange}
                          className='hidden'
                          id='avatar-upload-input'
                        />
                        <div className='flex flex-wrap items-center gap-2'>
                          <button
                            type='button'
                            onClick={() => fileInputRef.current?.click()}
                            className='border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-bold text-stone-800 transition hover:border-emerald-950 hover:bg-stone-50'
                          >
                            📁 Tải lên ảnh mới
                          </button>
                          {avatarPreview && (
                            <button
                              type='button'
                              onClick={handleRemoveAvatar}
                              className='border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 hover:border-red-300'
                            >
                              Gỡ ảnh
                            </button>
                          )}
                          {hasNewAvatar && (
                            <button
                              type='button'
                              onClick={handleResetAvatar}
                              className='text-xs text-stone-500 hover:text-stone-700 underline px-1'
                            >
                              Hủy chọn
                            </button>
                          )}
                        </div>
                        <p className='text-[11px] text-stone-400 leading-tight'>
                          Định dạng hỗ trợ: JPG, PNG, WEBP, GIF. Kích thước tối
                          đa 2MB.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* STT 2 & 3: Trường Họ tên */}
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
                      placeholder='Nhập họ và tên đầy đủ'
                      className='mt-1.5 w-full border border-stone-300 bg-stone-50 p-3 text-sm font-medium text-stone-800 outline-orange-700 transition focus:border-orange-700 focus:bg-white'
                    />
                    <span className='mt-1 block text-[11px] text-stone-400'>
                      Tên hiển thị trên các slide bài giảng và thanh điều hướng.
                    </span>
                  </div>

                  {/* STT 2: Trường Email (read-only) */}
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
                      Email định danh tài khoản đăng nhập không thể thay đổi
                      trực tiếp.
                    </span>
                  </div>
                </form>
              </div>

              {/* STT 4: Nút "Lưu thay đổi" */}
              <div className='mt-8 pt-4 border-t border-stone-200'>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                  <button
                    type='submit'
                    form='profile-form'
                    disabled={isSaving || cooldown > 0}
                    className='flex items-center justify-center gap-2 bg-emerald-950 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs'
                  >
                    {isSaving ? (
                      <>
                        <span className='inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent' />
                        <span>Đang cập nhật...</span>
                      </>
                    ) : cooldown > 0 ? (
                      <span>Vui lòng đợi ({cooldown}s)</span>
                    ) : (
                      <span>Lưu thay đổi</span>
                    )}
                  </button>

                  <span className='text-[11px] text-stone-500'>
                    🛡️ Giới hạn 60 giây giữa 2 lần cập nhật và tối đa 5 lần/giờ.
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Cột 3: Thẻ Bảo mật tài khoản (Dẫn sang /change-password riêng biệt) */}
          <div className='space-y-6'>
            <section className='border border-stone-300 bg-white p-6 shadow-xs'>
              <div className='border-b border-stone-200 pb-3'>
                <span className='text-[10px] font-bold tracking-wider uppercase text-orange-700'>
                  BẢO MẬT TÀI KHOẢN
                </span>
                <h3 className='mt-1 text-base font-bold text-emerald-950'>
                  Mật khẩu & Đăng nhập
                </h3>
              </div>

              <div className='mt-4 space-y-4 text-xs text-stone-600'>
                <div className='flex items-center gap-2 font-medium'>
                  <span className='text-emerald-700'>🔒</span>
                  <span>Mật khẩu đã được mã hóa an toàn</span>
                </div>
                <p className='text-stone-500 text-[11px] leading-relaxed'>
                  Để bảo vệ tài khoản, chức năng đổi mật khẩu đã được tách thành
                  trang riêng biệt và yêu cầu xác thực mật khẩu hiện tại.
                </p>

                <div className='pt-2'>
                  <button
                    type='button'
                    onClick={() => navigate('/change-password')}
                    className='w-full flex items-center justify-center gap-2 border border-stone-300 bg-stone-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-stone-800 transition hover:border-emerald-950 hover:bg-white shadow-2xs'
                  >
                    <span>Đổi mật khẩu tài khoản</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Thẻ thông tin phiên làm việc */}
            <section className='border border-stone-200 bg-stone-50 p-5 text-xs text-stone-600'>
              <div className='font-bold text-emerald-950 uppercase tracking-wider text-[10px] mb-2'>
                Thông tin phiên & Trạng thái
              </div>
              <ul className='space-y-1.5 text-[11px] text-stone-500'>
                <li>
                  • Trạng thái:{' '}
                  <span className='font-bold text-emerald-700'>
                    Đang hoạt động
                  </span>
                </li>
                <li>
                  • Vai trò:{' '}
                  <span className='font-bold text-stone-800 uppercase'>
                    {user?.role}
                  </span>
                </li>
                <li>
                  • Nạp Credit: Liên hệ quản trị viên để nhận thêm credit bài
                  giảng.
                </li>
              </ul>
            </section>
          </div>
        </div>

        {/* Khối Cài đặt giao diện & Hệ thống */}
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
