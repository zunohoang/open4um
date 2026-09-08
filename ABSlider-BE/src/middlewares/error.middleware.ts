import type { ErrorRequestHandler } from 'express'
import { AppError } from '@/utils/AppError'
import { logger } from '@/lib/logger'

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message })
    return
  }
  logger.error({ err }, '❌ Lỗi hệ thống chưa được xử lý')
  res
    .status(500)
    .json({ success: false, message: 'Đã có lỗi xảy ra, vui lòng thử lại' })
}
