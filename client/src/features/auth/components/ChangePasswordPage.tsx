import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/features/auth/api/auth.api'
import { PasswordInput } from '@/components/ui'

export const ChangePasswordPage = () => {
  const navigate = useNavigate()

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!oldPassword) {
      setErrorMessage('Vui lòng nhập mật khẩu hiện tại của bạn')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp với mật khẩu mới')
      return
    }
    if (newPassword === oldPassword) {
      setErrorMessage('Mật khẩu mới không được trùng với mật khẩu cũ')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await authApi.changePassword({
        oldPassword,
        newPassword,
        confirmPassword
      })
      setSuccessMessage(res.message || 'Đổi mật khẩu thành công!')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || 'Không thể đổi mật khẩu, vui lòng thử lại sau.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='mx-auto max-w-2xl px-5 py-10 sm:px-8 font-sans'>
      {/* Nút điều hướng quay lại */}
      <div className='mb-6 flex items-center gap-4 text-xs font-bold'>
        <button
          type='button'
          onClick={() => navigate('/profile')}
          className='inline-flex items-center gap-1.5 text-orange-700 hover:text-orange-800 transition'
        >
          <span>←</span>
          <span>Quay lại Hồ sơ cá nhân</span>
        </button>
        <span className='text-stone-300'>|</span>
        <button
          type='button'
          onClick={() => navigate('/library')}
          className='text-stone-500 hover:text-stone-700 transition'
        >
          Thư viện bài giảng
        </button>
      </div>

      {/* Header trang */}
      <div className='mb-8 border-b border-stone-200 pb-5'>
        <span className='text-xs font-bold tracking-widest uppercase text-orange-700'>
          BẢO MẬT TÀI KHOẢN
        </span>
        <h1 className='mt-1 font-serif text-3xl sm:text-4xl font-medium text-emerald-950'>
          Đổi mật khẩu đăng nhập
        </h1>
        <p className='mt-2 text-sm text-stone-600 leading-relaxed'>
          Để bảo vệ an toàn cho tài khoản của bạn, vui lòng nhập mật khẩu hiện
          tại và thiết lập mật khẩu mới có độ dài tối thiểu 6 ký tự.
        </p>
      </div>

      {/* Khung Form Đổi Mật Khẩu */}
      <div className='border border-stone-300 bg-white p-6 sm:p-8 shadow-xs'>
        {successMessage && (
          <div className='mb-6 flex items-start gap-2.5 border border-emerald-300 bg-emerald-50 p-4 text-xs font-bold text-emerald-800'>
            <span className='text-base'>✅</span>
            <div className='flex-1'>
              <p>{successMessage}</p>
              <button
                type='button'
                onClick={() => navigate('/profile')}
                className='mt-2 underline hover:text-emerald-950 transition block'
              >
                Trở về trang Hồ sơ cá nhân →
              </button>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className='mb-6 flex items-center gap-2 border border-red-300 bg-red-50 p-4 text-xs font-bold text-red-700'>
            <span className='text-base'>❌</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-5'>
          <div>
            <label
              htmlFor='current-password'
              className='block text-xs font-bold uppercase tracking-wider text-stone-700'
            >
              Mật khẩu hiện tại <span className='text-orange-700'>*</span>
            </label>
            <PasswordInput
              id='current-password'
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder='Nhập mật khẩu bạn đang sử dụng'
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
            <span className='mt-1 block text-[11px] text-stone-400'>
              Nên kết hợp chữ cái, chữ số và ký tự đặc biệt để tăng độ an toàn.
            </span>
          </div>

          <div>
            <label
              htmlFor='confirm-new-password'
              className='block text-xs font-bold uppercase tracking-wider text-stone-700'
            >
              Xác nhận mật khẩu mới <span className='text-orange-700'>*</span>
            </label>
            <PasswordInput
              id='confirm-new-password'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder='Nhập lại chính xác mật khẩu mới'
              required
            />
          </div>

          <div className='border-t border-stone-200 pt-5 flex items-center justify-between gap-4'>
            <button
              type='button'
              onClick={() => navigate('/profile')}
              className='border border-stone-300 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-stone-700 transition hover:bg-stone-100'
            >
              Hủy bỏ
            </button>

            <button
              type='submit'
              disabled={isSubmitting}
              className='flex items-center justify-center gap-2 bg-emerald-950 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs'
            >
              {isSubmitting ? (
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
      </div>

      {/* Chú thích an toàn */}
      <div className='mt-6 border border-stone-200 bg-stone-50 p-4 text-xs text-stone-600'>
        <div className='flex items-center gap-2 font-bold text-stone-800'>
          <span>🛡️</span>
          <span>Lưu ý bảo mật</span>
        </div>
        <p className='mt-1 text-[11px] text-stone-500 leading-relaxed'>
          Sau khi đổi mật khẩu thành công, bạn vẫn duy trì phiên đăng nhập hiện
          tại. Khi đăng nhập trên thiết bị mới, vui lòng dùng mật khẩu vừa cập
          nhật.
        </p>
      </div>
    </div>
  )
}

