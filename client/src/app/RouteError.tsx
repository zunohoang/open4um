import { useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

const RELOAD_KEY = 'abslider_chunk_reload'

const isChunkLoadError = (error: unknown) =>
  /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
    String((error as { message?: unknown })?.message ?? error)
  )

/** Trang lỗi của router: mất mạng khi tải trang con, hoặc file chunk cũ đã bị xóa sau deploy. */
export const RouteError = () => {
  const error = useRouteError()
  const chunkError = isChunkLoadError(error)

  // Có mạng mà không tải được chunk: bản build đã đổi sau deploy -> tải lại trang một lần.
  if (chunkError && navigator.onLine) {
    let reloadedRecently = true // không đọc/ghi được mốc thì không tự tải lại, tránh vòng lặp
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
      reloadedRecently = Date.now() - last < 10_000
      if (!reloadedRecently)
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    } catch {
      // giữ reloadedRecently = true
    }
    if (!reloadedRecently) {
      window.location.reload()
      return null
    }
  }

  const message =
    chunkError && !navigator.onLine
      ? 'Không thể kết nối mạng. Vui lòng kiểm tra kết nối và thử lại.'
      : chunkError
        ? 'Không tải được trang. Vui lòng thử lại.'
        : 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.'

  return (
    <div
      role='alert'
      className='flex min-h-screen flex-col items-center justify-center gap-4 bg-brand-paper p-6 text-center font-sans'
    >
      <p className='max-w-md text-sm font-bold text-brand-ink'>{message}</p>
      <div className='flex flex-wrap justify-center gap-2'>
        <Button type='button' onClick={() => window.location.reload()}>
          Thử lại
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => window.location.assign('/library')}
        >
          Về thư viện
        </Button>
      </div>
    </div>
  )
}
