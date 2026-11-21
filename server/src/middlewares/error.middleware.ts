import type { ErrorRequestHandler } from 'express'
import { AppError } from '@/utils/AppError'
import { logger } from '@/lib/logger'

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) return _next(err)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message })
    return
  }

  if ((err as { type?: string }).type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ success: false, message: 'Nội dung JSON không hợp lệ' })
    return
  }
  if ((err as { name?: string }).name === 'CastError') {
    res
      .status(400)
      .json({ success: false, message: 'Mã định danh không hợp lệ' })
    return
  }

  if (
    (err as { status?: number; statusCode?: number }).status === 413 ||
    (err as { status?: number; statusCode?: number }).statusCode === 413 ||
    (err as { type?: string }).type === 'entity.too.large'
  ) {
    res.status(413).json({
      success: false,
      message:
        'Dữ liệu gửi lên vượt quá dung lượng cho phép. Vui lòng giảm kích thước bản lưu hoặc tệp tải lên.'
    })
    return
  }

  logger.error({ err }, '❌ Lỗi hệ thống chưa được xử lý')
  res
    .status(500)
    .json({ success: false, message: 'Đã có lỗi xảy ra, vui lòng thử lại' })
}
