import { useEffect, useState, type FormEvent } from 'react'
import { adminApi } from '@/features/admin/api/admin.api'
import { Pagination } from '@/components/ui'
import type { AiUsageLog } from '@/lib/types'

const numberFormatter = new Intl.NumberFormat('vi-VN')
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'medium'
})

const getErrorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || 'Không thể tải lịch sử AI, vui lòng thử lại'

const getUserInfo = (log: AiUsageLog) => {
  if (typeof log.userId === 'object' && log.userId !== null) {
    return {
      name: log.userId.name || log.userId.email || log.userId._id.slice(-6),
      email: log.userId.email
    }
  }

  return {
    name: typeof log.userId === 'string' ? log.userId.slice(-6) : 'Ẩn danh',
    email: undefined
  }
}

export const AiUsageManagement = () => {
  const [logs, setLogs] = useState<AiUsageLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [appliedFrom, setAppliedFrom] = useState<string | undefined>()
  const [appliedTo, setAppliedTo] = useState<string | undefined>()
  const [reloadKey, setReloadKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchUsage = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await adminApi.getAiUsage({
          page,
          limit,
          from: appliedFrom,
          to: appliedTo
        })
        if (cancelled) return

        setLogs(response.items)
        setTotal(response.total)
      } catch (fetchError) {
        if (cancelled) return

        setLogs([])
        setTotal(0)
        setError(getErrorMessage(fetchError))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void fetchUsage()
    return () => {
      cancelled = true
    }
  }, [appliedFrom, appliedTo, limit, page, reloadKey])

  const applyDateFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (fromDate && toDate && fromDate > toDate) {
      setFilterError('Từ ngày không được sau Đến ngày')
      return
    }

    setFilterError(null)
    setPage(1)
    setAppliedFrom(fromDate || undefined)
    setAppliedTo(toDate || undefined)
    setReloadKey((current) => current + 1)
  }

  const clearDateFilter = () => {
    setFromDate('')
    setToDate('')
    setAppliedFrom(undefined)
    setAppliedTo(undefined)
    setFilterError(null)
    setPage(1)
    setReloadKey((current) => current + 1)
  }

  return (
    <section className='border border-stone-300 bg-stone-50 p-5 sm:p-7'>
      <div className='flex flex-col gap-1'>
        <h2 className='text-2xl font-medium text-emerald-950'>
          Quản lý AI Usage
        </h2>
        <p className='font-sans text-xs text-stone-500'>
          Theo dõi prompt, số slide được tạo và lượng credit đã trừ trên toàn hệ
          thống
        </p>
      </div>

      <form
        className='mt-6 border border-stone-200 bg-white p-4 font-sans'
        onSubmit={applyDateFilter}
      >
        <div className='flex flex-col gap-3 lg:flex-row lg:items-end'>
          <label className='flex flex-1 flex-col gap-1.5 text-xs font-semibold text-stone-600'>
            Từ ngày
            <input
              className='h-10 border border-stone-300 bg-white px-3 text-sm font-normal text-stone-900 outline-orange-700'
              type='date'
              max={toDate || undefined}
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value)
                setFilterError(null)
              }}
            />
          </label>
          <label className='flex flex-1 flex-col gap-1.5 text-xs font-semibold text-stone-600'>
            Đến ngày
            <input
              className='h-10 border border-stone-300 bg-white px-3 text-sm font-normal text-stone-900 outline-orange-700'
              type='date'
              min={fromDate || undefined}
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value)
                setFilterError(null)
              }}
            />
          </label>
          <div className='flex gap-2'>
            <button
              className='h-10 bg-emerald-950 px-5 text-xs font-bold text-white transition hover:bg-stone-900 disabled:cursor-not-allowed disabled:opacity-60'
              disabled={isLoading}
              type='submit'
            >
              Áp dụng
            </button>
            <button
              className='h-10 border border-stone-300 bg-white px-5 text-xs font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60'
              disabled={isLoading || (!fromDate && !toDate)}
              onClick={clearDateFilter}
              type='button'
            >
              Xóa lọc
            </button>
          </div>
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

      <div className='mt-5 overflow-x-auto'>
        <table className='w-full min-w-[860px] text-left font-sans text-sm'>
          <thead>
            <tr className='border-b border-stone-300 text-xs tracking-wider text-stone-500 uppercase'>
              <th className='py-3 pr-4'>Thời gian</th>
              <th className='py-3 pr-4'>Người dùng</th>
              <th className='py-3 pr-4'>Nội dung Prompt</th>
              <th className='py-3 pr-4 text-right'>Số slide</th>
              <th className='py-3 text-right'>Credit đã trừ</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-stone-200'>
            {isLoading ? (
              <tr>
                <td className='py-10 text-center text-stone-500' colSpan={5}>
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td className='py-10 text-center text-stone-500' colSpan={5}>
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const user = getUserInfo(log)
                return (
                  <tr className='align-top hover:bg-stone-100/60' key={log._id}>
                    <td className='whitespace-nowrap py-3 pr-4 font-mono text-xs text-stone-500'>
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
                    <td className='max-w-xl min-w-72 whitespace-pre-wrap break-words py-3 pr-4 text-stone-800'>
                      {log.prompt || '(Trống)'}
                    </td>
                    <td className='py-3 pr-4 text-right text-stone-600'>
                      {numberFormatter.format(log.slideCount)}
                    </td>
                    <td className='py-3 text-right font-semibold text-orange-700'>
                      -{numberFormatter.format(log.creditSpent)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        total={total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={(newLimit) => {
          setLimit(newLimit)
          setPage(1)
        }}
        itemName='lượt sử dụng AI'
      />
    </section>
  )
}
