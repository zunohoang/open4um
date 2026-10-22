import { useEffect, useState, type FormEvent } from 'react'
import { adminApi } from '@/features/admin/api/admin.api'
import { getUserInfo } from '@/features/admin/components/AiUsageManagement'
import {
  TimeSeriesChart,
  formatDay
} from '@/features/admin/components/TimeSeriesChart'
import { cn } from '@/lib/cn'
import type { DashboardStats, DashboardTotals } from '@/lib/types'

const PRESET_DAYS = [7, 30, 90]
const DEFAULT_DAYS = 30
const MAX_RANGE_DAYS = 366

const numberFormatter = new Intl.NumberFormat('vi-VN')
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'medium'
})

const STAT_CARDS: { key: keyof DashboardTotals; label: string }[] = [
  { key: 'users', label: 'Người dùng đăng ký' },
  { key: 'lectures', label: 'Bài giảng được tạo' },
  { key: 'aiSlides', label: 'Slide tạo bằng AI' },
  { key: 'aiUsages', label: 'Lượt sử dụng AI' },
  { key: 'creditsSpent', label: 'Credit đã tiêu thụ' }
]

const getErrorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || 'Không thể tải dữ liệu thống kê, vui lòng thử lại'

// Ngày (YYYY-MM-DD) theo giờ máy, lùi lại `daysAgo` ngày
const localDateKey = (daysAgo = 0) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
}

const presetRange = (days: number) => ({
  from: localDateKey(days - 1),
  to: localDateKey()
})

export const AdminDashboard = () => {
  const [range, setRange] = useState(() => presetRange(DEFAULT_DAYS))
  const [fromInput, setFromInput] = useState(range.from)
  const [toInput, setToInput] = useState(range.to)
  const [activePreset, setActivePreset] = useState<number | null>(DEFAULT_DAYS)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchStats = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await adminApi.getDashboard(range)
        if (cancelled) return
        setStats(response)
      } catch (fetchError) {
        if (cancelled) return
        setStats(null)
        setError(getErrorMessage(fetchError))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void fetchStats()
    return () => {
      cancelled = true
    }
  }, [range, reloadKey])

  const applyPreset = (days: number) => {
    const next = presetRange(days)
    setActivePreset(days)
    setFromInput(next.from)
    setToInput(next.to)
    setFilterError(null)
    setRange(next)
  }

  const applyCustomRange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!fromInput || !toInput) {
      setFilterError('Vui lòng chọn đủ Từ ngày và Đến ngày')
      return
    }
    if (fromInput > toInput) {
      setFilterError('Từ ngày không được sau Đến ngày')
      return
    }
    const days =
      (Date.parse(toInput) - Date.parse(fromInput)) / (24 * 60 * 60 * 1000) + 1
    if (days > MAX_RANGE_DAYS) {
      setFilterError(`Khoảng thời gian thống kê tối đa ${MAX_RANGE_DAYS} ngày`)
      return
    }
    setFilterError(null)
    setActivePreset(null)
    setRange({ from: fromInput, to: toInput })
  }

  return (
    <section className='border border-stone-300 bg-stone-50 p-5 sm:p-7'>
      <div className='flex flex-col gap-1'>
        <h2 className='text-2xl font-medium text-emerald-950'>
          Tổng quan hệ thống
        </h2>
        <p className='font-sans text-xs text-stone-500'>
          Thống kê người dùng, bài giảng, hoạt động AI và mức tiêu thụ credit
          trên toàn hệ thống
        </p>
      </div>

      {/* Một hàng bộ lọc phía trên, áp dụng cho mọi số liệu bên dưới */}
      <form
        className='mt-6 border border-stone-200 bg-white p-4 font-sans'
        onSubmit={applyCustomRange}
      >
        <div className='flex flex-col gap-3 lg:flex-row lg:items-end'>
          <div
            aria-label='Chọn nhanh khoảng thời gian'
            className='flex flex-wrap gap-2'
            role='group'
          >
            {PRESET_DAYS.map((days) => (
              <button
                aria-pressed={activePreset === days}
                className={cn(
                  'h-10 border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                  activePreset === days
                    ? 'border-emerald-950 bg-emerald-950 text-white'
                    : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
                )}
                disabled={isLoading}
                key={days}
                onClick={() => applyPreset(days)}
                type='button'
              >
                {days} ngày qua
              </button>
            ))}
          </div>
          <label className='flex flex-1 flex-col gap-1.5 text-xs font-semibold text-stone-600'>
            Từ ngày
            <input
              className='h-10 border border-stone-300 bg-white px-3 text-sm font-normal text-stone-900 outline-orange-700'
              max={toInput || undefined}
              onChange={(event) => {
                setFromInput(event.target.value)
                setFilterError(null)
              }}
              type='date'
              value={fromInput}
            />
          </label>
          <label className='flex flex-1 flex-col gap-1.5 text-xs font-semibold text-stone-600'>
            Đến ngày
            <input
              className='h-10 border border-stone-300 bg-white px-3 text-sm font-normal text-stone-900 outline-orange-700'
              min={fromInput || undefined}
              onChange={(event) => {
                setToInput(event.target.value)
                setFilterError(null)
              }}
              type='date'
              value={toInput}
            />
          </label>
          <button
            className='h-10 bg-emerald-950 px-5 text-xs font-bold text-white transition hover:bg-stone-900 disabled:cursor-not-allowed disabled:opacity-60'
            disabled={isLoading}
            type='submit'
          >
            Áp dụng
          </button>
        </div>
        {filterError && (
          <p className='mt-2 text-xs font-semibold text-red-700' role='alert'>
            {filterError}
          </p>
        )}
      </form>

      {error && (
        <div
          className='mt-5 flex flex-col gap-3 border border-red-200 bg-red-50 p-4 font-sans text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between'
          role='alert'
        >
          <span>{error}</span>
          <button
            className='self-start font-semibold underline underline-offset-2 sm:self-auto'
            onClick={() => setReloadKey((current) => current + 1)}
            type='button'
          >
            Thử lại
          </button>
        </div>
      )}

      {!stats && isLoading && (
        <div className='py-12 text-center font-sans text-sm text-stone-500'>
          Đang tải dữ liệu thống kê...
        </div>
      )}

      {stats && (
        // Khi lọc lại: giữ số liệu cũ, làm mờ thay vì nháy trắng
        <div
          aria-busy={isLoading}
          className={cn(
            'mt-5 space-y-5 transition-opacity',
            isLoading && 'opacity-60'
          )}
        >
          <p className='font-sans text-xs text-stone-500'>
            Số liệu từ {formatDay(stats.from, true)} đến{' '}
            {formatDay(stats.to, true)} (giờ Việt Nam)
            {isLoading && ' · Đang cập nhật...'}
          </p>

          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5'>
            {STAT_CARDS.map(({ key, label }) => (
              <div
                className='border border-stone-200 bg-white p-4 font-sans last:col-span-2 sm:last:col-span-1'
                key={key}
              >
                <div className='text-xs font-semibold text-stone-500'>
                  {label}
                </div>
                <div className='mt-2 text-3xl font-semibold text-emerald-950'>
                  {numberFormatter.format(stats.totals[key])}
                </div>
                <div className='mt-1 text-xs text-stone-500'>
                  Toàn hệ thống: {numberFormatter.format(stats.allTime[key])}
                </div>
              </div>
            ))}
          </div>

          <div className='grid gap-4 xl:grid-cols-3'>
            <TimeSeriesChart
              points={stats.series.map((point) => ({
                date: point.date,
                value: point.users
              }))}
              title='Người dùng đăng ký mới'
              unit='người dùng'
            />
            <TimeSeriesChart
              points={stats.series.map((point) => ({
                date: point.date,
                value: point.lectures
              }))}
              title='Bài giảng được tạo'
              unit='bài giảng'
            />
            <TimeSeriesChart
              points={stats.series.map((point) => ({
                date: point.date,
                value: point.creditsSpent
              }))}
              title='Credit tiêu thụ'
              unit='credit'
            />
          </div>

          <div className='border border-stone-200 bg-white p-4 font-sans'>
            <h3 className='text-sm font-semibold text-stone-900'>
              Hoạt động AI gần đây
            </h3>
            <p className='text-xs text-stone-500'>
              {stats.recentActivities.length > 0
                ? `${stats.recentActivities.length} lượt sử dụng AI mới nhất trong khoảng thời gian đã chọn`
                : 'Các lượt sử dụng AI mới nhất trong khoảng thời gian đã chọn'}
            </p>
            {stats.recentActivities.length === 0 ? (
              <div className='py-10 text-center text-sm text-stone-500'>
                Chưa có dữ liệu
              </div>
            ) : (
              <div className='mt-3 overflow-x-auto'>
                <table className='w-full min-w-[760px] text-left text-sm'>
                  <thead>
                    <tr className='border-b border-stone-300 text-xs tracking-wider text-stone-500 uppercase'>
                      <th className='py-3 pr-4' scope='col'>
                        Thời gian
                      </th>
                      <th className='py-3 pr-4' scope='col'>
                        Người dùng
                      </th>
                      <th className='py-3 pr-4' scope='col'>
                        Nội dung Prompt
                      </th>
                      <th className='py-3 pr-4 text-right' scope='col'>
                        Số slide
                      </th>
                      <th className='py-3 text-right' scope='col'>
                        Credit đã trừ
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-stone-200'>
                    {stats.recentActivities.map((log) => {
                      const user = getUserInfo(log)
                      return (
                        <tr className='align-top' key={log._id}>
                          <td className='whitespace-nowrap py-3 pr-4 font-mono text-xs text-stone-500 tabular-nums'>
                            {dateTimeFormatter.format(new Date(log.createdAt))}
                          </td>
                          <td className='py-3 pr-4 text-xs text-stone-800'>
                            <div className='font-semibold'>{user.name}</div>
                            {user.email && (
                              <div className='font-mono text-[11px] text-stone-400'>
                                {user.email}
                              </div>
                            )}
                          </td>
                          <td className='max-w-xl min-w-64 whitespace-pre-wrap break-words py-3 pr-4 text-stone-800'>
                            {log.prompt || '(Trống)'}
                          </td>
                          <td className='py-3 pr-4 text-right tabular-nums text-stone-600'>
                            {numberFormatter.format(log.slideCount)}
                          </td>
                          <td className='py-3 text-right font-semibold tabular-nums text-orange-700'>
                            -{numberFormatter.format(log.creditSpent)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
