interface PaginationProps {
  page: number
  total: number
  limit: number
  onPageChange: (newPage: number) => void
  onLimitChange?: (newLimit: number) => void
  limitOptions?: number[]
  itemName?: string
}

export const Pagination = ({
  page,
  total,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50],
  itemName = 'kết quả'
}: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.min(Math.max(1, page), totalPages)

  const from = total === 0 ? 0 : (currentPage - 1) * limit + 1
  const to = Math.min(currentPage * limit, total)

  // Tạo mảng các số trang cần hiển thị với dấu chấm lửng
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages]
    }

    if (currentPage >= totalPages - 3) {
      return [
        1,
        '...',
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages
      ]
    }

    return [
      1,
      '...',
      currentPage - 1,
      currentPage,
      currentPage + 1,
      '...',
      totalPages
    ]
  }

  const pages = getPageNumbers()

  return (
    <div className='mt-6 flex flex-col gap-4 border-t border-stone-200 pt-4 font-sans text-xs sm:flex-row sm:items-center sm:justify-between'>
      {/* Thông tin số lượng & số dòng mỗi trang */}
      <div className='flex flex-wrap items-center gap-3 text-stone-600'>
        <span>
          Hiển thị <strong className='text-stone-900'>{from}</strong> -{' '}
          <strong className='text-stone-900'>{to}</strong> trong tổng số{' '}
          <strong className='text-stone-900'>{total}</strong> {itemName}
        </span>

        {onLimitChange && (
          <div className='flex items-center gap-1.5 border-l border-stone-300 pl-3'>
            <label htmlFor='pagination-limit' className='text-stone-500'>
              Hiển thị:
            </label>
            <select
              id='pagination-limit'
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className='rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 outline-orange-700'
            >
              {limitOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / trang
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Điều hướng trang */}
      {totalPages > 1 && (
        <div className='flex items-center gap-1 self-center sm:self-auto'>
          {/* Nút Về trang đầu */}
          <button
            type='button'
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            title='Trang đầu'
            className='flex h-8 w-8 items-center justify-center rounded border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40'
          >
            «
          </button>

          {/* Nút Trang trước */}
          <button
            type='button'
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            title='Trang trước'
            className='flex h-8 w-8 items-center justify-center rounded border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40'
          >
            ‹
          </button>

          {/* Danh sách các số trang */}
          <div className='flex items-center gap-1'>
            {pages.map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className='flex h-8 w-6 items-center justify-center text-stone-400'
                  >
                    …
                  </span>
                )
              }

              const isCurrent = p === currentPage
              return (
                <button
                  key={`page-${p}`}
                  type='button'
                  onClick={() => onPageChange(p as number)}
                  className={`flex h-8 min-w-8 items-center justify-center rounded border px-2 text-xs font-semibold transition ${
                    isCurrent
                      ? 'border-orange-700 bg-orange-700 text-white'
                      : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {p}
                </button>
              )
            })}
          </div>

          {/* Nút Trang sau */}
          <button
            type='button'
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            title='Trang kế tiếp'
            className='flex h-8 w-8 items-center justify-center rounded border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40'
          >
            ›
          </button>

          {/* Nút Đến trang cuối */}
          <button
            type='button'
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            title='Trang cuối'
            className='flex h-8 w-8 items-center justify-center rounded border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40'
          >
            »
          </button>
        </div>
      )}
    </div>
  )
}
