import type { ErrorRequestHandler } from 'express'
import { AppError } from '@/utils/AppError'
import { logger } from '@/lib/logger'

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message })
    return
  }

  if (
    (err as { status?: number; statusCode?: number }).status === 413 ||
    (err as { status?: number; statusCode?: number }).statusCode === 413 ||
    (err as { type?: string }).type === 'entity.too.large'
  ) {
    res.status(413).json({
      success: false,
      message: 'Ảnh vượt quá dung lượng cho phép hoặc sai định dạng tệp tin'
    })
    return
  }

  logger.error({ err }, '❌ Lỗi hệ thống chưa được xử lý')
  res
    .status(500)
    .json({ success: false, message: 'Đã có lỗi xảy ra, vui lòng thử lại' })
}
