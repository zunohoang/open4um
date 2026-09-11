import { FormEvent, useEffect, useState } from 'react'
import { authApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { PasswordInput, useToast } from '@/components/ui'

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    return (
      (error as { response?: { data?: { message?: string } } }).response?.data
        ?.message ?? 'Có lỗi xảy ra'
    )
  }
  return 'Có lỗi xảy ra'
}

type AuthMode = 'login' | 'register' | 'forgot-password'

const isEmailVerificationEnabled =
  import.meta.env.VITE_ENABLE_EMAIL_VERIFICATION !== 'false'

export const AuthPage = () => {
  const setSession = useAuthStore((state) => state.setSession)
  const { showToast } = useToast()

  const [mode, setMode] = useState<AuthMode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form states
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    otp: ''
  })
  const [registerStep, setRegisterStep] = useState<'info' | 'otp'>('info')
  const [registerCooldown, setRegisterCooldown] = useState(0)

  // Forgot password form states
  const [forgotForm, setForgotForm] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [forgotStep, setForgotStep] = useState<'email' | 'reset'>('email')
  const [forgotCooldown, setForgotCooldown] = useState(0)

  // Cooldown timers
  useEffect(() => {
    if (registerCooldown <= 0) return
    const timer = setInterval(() => {
      setRegisterCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [registerCooldown])

  useEffect(() => {
    if (forgotCooldown <= 0) return
    const timer = setInterval(() => {
      setForgotCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [forgotCooldown])

  const resetErrors = () => {
    setError('')
  }

  // --- REGISTRATION FLOW ---
  const handleRequestRegisterOtp = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    if (!form.email || !form.name || !form.password) {
      setError('Vui lòng điền đầy đủ họ tên, email và mật khẩu')
      return
    }
    if (form.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }

    resetErrors()
    setLoading(true)
    try {
      const res = await authApi.sendRegisterOtp({ email: form.email })
      showToast(
        res.message || 'Mã OTP đã được gửi đến email của bạn',
        'success'
      )
      setRegisterStep('otp')
      setRegisterCooldown(60)
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isEmailVerificationEnabled) {
      if (!form.email || !form.name || !form.password) {
        setError('Vui lòng điền đầy đủ họ tên, email và mật khẩu')
        return
      }
      if (form.password.length < 6) {
        setError('Mật khẩu phải có ít nhất 6 ký tự')
        return
      }

      resetErrors()
      setLoading(true)
      try {
        const session = await authApi.register({
          name: form.name,
          email: form.email,
          password: form.password
        })
        showToast('Đăng ký tài khoản thành công!', 'success')
        setSession(session)
      } catch (err) {
        const msg = getErrorMessage(err)
        setError(msg)
        showToast(msg, 'error')
      } finally {
        setLoading(false)
      }
      return
    }

    await handleRequestRegisterOtp()
  }

  const handleCompleteRegister = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.otp || form.otp.length !== 6) {
      setError('Vui lòng nhập mã OTP 6 chữ số')
      return
    }

    resetErrors()
    setLoading(true)
    try {
      const session = await authApi.register({
        name: form.name,
        email: form.email,
        password: form.password,
        otp: form.otp
      })
      showToast('Đăng ký tài khoản thành công!', 'success')
      setSession(session)
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  // --- FORGOT PASSWORD FLOW ---
  const handleRequestForgotOtp = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    if (!forgotForm.email) {
      setError('Vui lòng nhập địa chỉ email')
      return
    }

    resetErrors()
    setLoading(true)
    try {
      const res = await authApi.forgotPassword({ email: forgotForm.email })
      showToast(
        res.message || 'Mã xác thực đã được gửi đến email của bạn',
        'success'
      )
      setForgotStep('reset') // Used here to show success confirmation state
      setForgotCooldown(60)
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  // --- LOGIN FLOW ---
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    resetErrors()
    setLoading(true)
    try {
      const session = await authApi.login({
        email: form.email,
        password: form.password
      })
      setSession(session)
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className='grid min-h-screen bg-stone-100 lg:grid-cols-[1.1fr_.9fr]'>
      <section className='flex min-h-[45vh] flex-col justify-center bg-emerald-950 px-8 py-16 text-stone-100 sm:px-16 lg:min-h-screen lg:px-[9vw]'>
        <span className='font-sans text-xs font-bold tracking-widest text-orange-300'>
          ABSLIDER / STUDIO
        </span>
        <h1 className='mt-6 max-w-2xl text-6xl font-medium leading-[1.1] sm:text-7xl'>
          Biến ý tưởng thành bài giảng.
        </h1>
        <p className='mt-7 max-w-md font-sans text-base leading-7 text-emerald-100'>
          Không gian trực quan để xây dựng các slide bài giảng cùng AI.
        </p>
        <div
          className='mt-16 grid max-w-md grid-cols-4 gap-2'
          aria-hidden='true'
        >
          <span className='aspect-square bg-amber-400' />
          <span className='aspect-square translate-y-6 bg-orange-500' />
          <span className='aspect-square bg-stone-100' />
          <span className='aspect-square translate-y-6 bg-emerald-500' />
        </div>
      </section>

      <div className='m-auto w-full max-w-md bg-stone-100 px-8 py-12 sm:px-12 lg:p-14'>
        {/* --- LOGIN MODE --- */}
        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <span className='text-xs font-bold tracking-widest text-orange-700'>
              WELCOME BACK
            </span>
            <h2 className='mt-4 text-4xl font-medium'>Đăng nhập</h2>
            <p className='mt-2 font-sans text-sm leading-6 text-stone-500'>
              Tiếp tục xây dựng bài giảng của bạn.
            </p>

            <label className='mt-8 block font-sans text-sm font-semibold text-stone-600'>
              Email
              <input
                className='mt-2 w-full border border-stone-300 bg-stone-50 p-3 outline-orange-600'
                type='email'
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>

            <label className='mt-5 block font-sans text-sm font-semibold text-stone-600'>
              <div className='flex items-center justify-between'>
                <span>Mật khẩu</span>
                <button
                  type='button'
                  className='text-xs font-semibold text-orange-700 hover:underline'
                  onClick={() => {
                    resetErrors()
                    setForgotForm((prev) => ({ ...prev, email: form.email }))
                    setMode('forgot-password')
                  }}
                >
                  Quên mật khẩu?
                </button>
              </div>
              <PasswordInput
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder='••••••••'
                required
              />
            </label>

            {error && (
              <div className='mt-4 border border-red-200 bg-red-50 p-3.5 text-xs font-semibold leading-relaxed text-red-800'>
                ⚠️ {error}
              </div>
            )}

            <button
              className='mt-7 w-full bg-orange-700 px-4 py-3 font-sans text-sm font-bold text-white hover:bg-orange-800 disabled:opacity-50'
              type='submit'
              disabled={loading}
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>

            <button
              className='mt-5 w-full font-sans text-sm font-semibold text-orange-700 hover:underline'
              type='button'
              onClick={() => {
                resetErrors()
                setMode('register')
                setRegisterStep('info')
              }}
            >
              Chưa có tài khoản? Đăng ký
            </button>
          </form>
        )}

        {/* --- REGISTER MODE --- */}
        {mode === 'register' && (
          <div>
            <span className='text-xs font-bold tracking-widest text-orange-700'>
              GET STARTED
            </span>
            <h2 className='mt-4 text-4xl font-medium'>Tạo tài khoản</h2>
            <p className='mt-2 font-sans text-sm leading-6 text-stone-500'>
              {registerStep === 'info'
                ? 'Bắt đầu với credit AI mặc định.'
                : 'Xác thực mã OTP gửi đến hòm thư của bạn.'}
            </p>

            {registerStep === 'info' ? (
              <form onSubmit={handleRegisterSubmit}>
                <label className='mt-8 block font-sans text-sm font-semibold text-stone-600'>
                  Họ tên
                  <input
                    className='mt-2 w-full border border-stone-300 bg-stone-50 p-3 outline-orange-600'
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </label>

                <label className='mt-5 block font-sans text-sm font-semibold text-stone-600'>
                  Email
                  <input
                    className='mt-2 w-full border border-stone-300 bg-stone-50 p-3 outline-orange-600'
                    type='email'
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    required
                  />
                </label>

                <label className='mt-5 block font-sans text-sm font-semibold text-stone-600'>
                  Mật khẩu
                  <PasswordInput
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder='••••••••'
                    required
                  />
                </label>

                {error && (
                  <div className='mt-4 border border-red-200 bg-red-50 p-3.5 text-xs font-semibold leading-relaxed text-red-800'>
                    ⚠️ {error}
                  </div>
                )}

                <button
                  className='mt-7 w-full bg-orange-700 px-4 py-3 font-sans text-sm font-bold text-white hover:bg-orange-800 disabled:opacity-50'
                  type='submit'
                  disabled={loading}
                >
                  {loading
                    ? isEmailVerificationEnabled
                      ? 'Đang gửi mã OTP...'
                      : 'Đang đăng ký...'
                    : isEmailVerificationEnabled
                      ? 'Tiếp tục & Nhận mã OTP'
                      : 'Đăng ký tài khoản'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCompleteRegister}>
                <div className='mt-6 rounded-md border border-orange-200 bg-orange-50 p-4'>
                  <p className='font-sans text-xs text-stone-600'>
                    Mã xác thực 6 chữ số đã được gửi tới:
                  </p>
                  <p className='mt-1 font-sans text-sm font-bold text-orange-950'>
                    {form.email}
                  </p>
                </div>

                <label className='mt-5 block font-sans text-sm font-semibold text-stone-600'>
                  Mã xác thực OTP
                  <input
                    className='mt-2 w-full border border-stone-300 bg-stone-50 p-3 text-center font-mono text-2xl font-bold tracking-widest outline-orange-600'
                    type='text'
                    maxLength={6}
                    placeholder='••••••'
                    value={form.otp}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        otp: e.target.value.replace(/\D/g, '')
                      })
                    }
                    required
                    autoFocus
                  />
                </label>

                <div className='mt-3 flex items-center justify-between text-xs'>
                  <span className='text-stone-500'>Không nhận được mã?</span>
                  <button
                    type='button'
                    className='font-semibold text-orange-700 hover:underline disabled:opacity-50'
                    onClick={() => handleRequestRegisterOtp()}
                    disabled={loading || registerCooldown > 0}
                  >
                    {registerCooldown > 0
                      ? `Gửi lại mã (${registerCooldown}s)`
                      : 'Gửi lại mã OTP'}
                  </button>
                </div>

                {error && (
                  <div className='mt-4 border border-red-200 bg-red-50 p-3.5 text-xs font-semibold leading-relaxed text-red-800'>
                    ⚠️ {error}
                  </div>
                )}

                <button
                  className='mt-7 w-full bg-orange-700 px-4 py-3 font-sans text-sm font-bold text-white hover:bg-orange-800 disabled:opacity-50'
                  type='submit'
                  disabled={loading}
                >
                  {loading ? 'Đang tạo tài khoản...' : 'Hoàn tất đăng ký'}
                </button>

                <button
                  type='button'
                  className='mt-3 w-full font-sans text-xs font-semibold text-stone-500 hover:text-stone-700'
                  onClick={() => {
                    resetErrors()
                    setRegisterStep('info')
                  }}
                >
                  ← Quay lại chỉnh sửa thông tin
                </button>
              </form>
            )}

            <button
              className='mt-5 w-full font-sans text-sm font-semibold text-orange-700 hover:underline'
              type='button'
              onClick={() => {
                resetErrors()
                setMode('login')
              }}
            >
              Đã có tài khoản? Đăng nhập
            </button>
          </div>
        )}

        {/* --- FORGOT PASSWORD MODE --- */}
        {mode === 'forgot-password' && (
          <div>
            <span className='text-xs font-bold tracking-widest text-orange-700'>
              ACCOUNT RECOVERY
            </span>
            <h2 className='mt-4 text-4xl font-medium'>Quên mật khẩu</h2>
            <p className='mt-2 font-sans text-sm leading-6 text-stone-500'>
              {forgotStep === 'email'
                ? 'Nhập email tài khoản để nhận mã đặt lại mật khẩu.'
                : 'Nhập mã OTP và mật khẩu mới của bạn.'}
            </p>

            {forgotStep === 'email' ? (
              <form onSubmit={handleRequestForgotOtp}>
                <label className='mt-8 block font-sans text-sm font-semibold text-stone-600'>
                  Email tài khoản
                  <input
                    className='mt-2 w-full border border-stone-300 bg-stone-50 p-3 outline-orange-600'
                    type='email'
                    value={forgotForm.email}
                    onChange={(e) =>
                      setForgotForm({ ...forgotForm, email: e.target.value })
                    }
                    placeholder='your-email@example.com'
                    required
                  />
                </label>

                {error && (
                  <div className='mt-4 border border-red-200 bg-red-50 p-3.5 text-xs font-semibold leading-relaxed text-red-800'>
                    ⚠️ {error}
                  </div>
                )}

                <button
                  className='mt-7 w-full bg-orange-700 px-4 py-3 font-sans text-sm font-bold text-white hover:bg-orange-800 disabled:opacity-50'
                  type='submit'
                  disabled={loading}
                >
                  {loading ? 'Đang gửi mã...' : 'Gửi mã xác nhận'}
                </button>
              </form>
            ) : (
              <div className='mt-6 space-y-4'>
                <div className='rounded-md border border-emerald-200 bg-emerald-50 p-4'>
                  <p className='font-sans text-sm font-semibold text-emerald-900'>
                    ✅ Yêu cầu đã được gửi thành công!
                  </p>
                  <p className='mt-1 font-sans text-xs text-emerald-700'>
                    Mã xác thực đã được gửi đến email{' '}
                    <strong>{forgotForm.email}</strong>. Vui lòng kiểm tra hộp
                    thư đến của bạn.
                  </p>
                </div>
                <button
                  type='button'
                  className='w-full font-sans text-xs font-semibold text-orange-700 hover:underline disabled:opacity-50'
                  onClick={() => handleRequestForgotOtp()}
                  disabled={loading || forgotCooldown > 0}
                >
                  {forgotCooldown > 0
                    ? `Gửi lại mã (${forgotCooldown}s)`
                    : 'Gửi lại mã xác nhận'}
                </button>
              </div>
            )}

            <button
              className='mt-5 w-full font-sans text-sm font-semibold text-orange-700 hover:underline'
              type='button'
              onClick={() => {
                resetErrors()
                setMode('login')
              }}
            >
              ← Quay lại đăng nhập
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
