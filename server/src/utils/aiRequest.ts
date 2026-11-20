import type { Request, Response } from 'express'
import { env } from '@/config/env'
import { AppError } from '@/utils/AppError'

// Ngắt upstream trước gateway và khi trình duyệt/gateway đóng kết nối.
export const withAiRequest = async <T>(
  req: Request,
  res: Response,
  work: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
  const controller = new AbortController()
  const cancel = () => {
    if (!res.writableFinished)
      controller.abort(new AppError('Yêu cầu AI đã bị hủy', 499))
  }
  req.once('aborted', cancel)
  res.once('close', cancel)
  const timer = setTimeout(
    () =>
      controller.abort(
        new AppError(
          'AI phản hồi quá lâu. Vui lòng thử lại; yêu cầu này không bị tính credit.',
          504
        )
      ),
    env.AI_REQUEST_TIMEOUT_MS
  )
  try {
    return await work(controller.signal)
  } finally {
    clearTimeout(timer)
    req.off('aborted', cancel)
    res.off('close', cancel)
  }
}
