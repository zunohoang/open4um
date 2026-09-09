import { FormEvent, useState } from 'react'
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

export const AuthPage = () => {
  const setSession = useAuthStore((state) => state.setSession)
  const { showToast } = useToast()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const session =
        mode === 'login'
          ? await authApi.login({ email: form.email, password: form.password })
          : await authApi.register(form)
      setSession(session)
    } catch (requestError) {
      const msg = getErrorMessage(requestError)
      setError(msg)
      showToast(msg, 'error')
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
      <form
        className='m-auto w-full max-w-md bg-stone-100 px-8 py-12 sm:px-12 lg:p-14'
        onSubmit={submit}
      >
        <span className='text-xs font-bold tracking-widest text-orange-700'>
          WELCOME BACK
        </span>
        <h2 className='mt-4 text-4xl font-medium'>
          {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
        </h2>
        <p className='mt-2 font-sans text-sm leading-6 text-stone-500'>
          {mode === 'login'
            ? 'Tiếp tục xây dựng bài giảng của bạn.'
            : 'Bắt đầu với credit AI mặc định.'}
        </p>
        {mode === 'register' && (
          <label className='mt-8 block font-sans text-sm font-semibold text-stone-600'>
            Họ tên
            <input
              className='mt-2 w-full border border-stone-300 bg-stone-50 p-3 outline-orange-600'
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
            />
          </label>
        )}
        <label className='mt-5 block font-sans text-sm font-semibold text-stone-600'>
          Email
          <input
            className='mt-2 w-full border border-stone-300 bg-stone-50 p-3 outline-orange-600'
            type='email'
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            required
          />
        </label>
        <label className='mt-5 block font-sans text-sm font-semibold text-stone-600'>
          Mật khẩu
          <PasswordInput
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
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
          className='mt-7 w-full bg-orange-700 px-4 py-3 font-sans text-sm font-bold text-white hover:bg-orange-800'
          type='submit'
        >
          {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
        </button>
        <button
          className='mt-5 w-full font-sans text-sm font-semibold text-orange-700'
          type='button'
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login'
            ? 'Chưa có tài khoản? Đăng ký'
            : 'Đã có tài khoản? Đăng nhập'}
        </button>
      </form>
    </main>
  )
}
