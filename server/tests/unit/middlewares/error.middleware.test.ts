import type { Request, Response, NextFunction } from 'express'
import { AppError } from '@/utils/AppError'
import { errorMiddleware } from '@/middlewares/error.middleware'

describe('error.middleware', () => {
  let req: Partial<Request>
  let res: Partial<Response>
  let next: NextFunction

  beforeEach(() => {
    req = {}
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    }
    next = jest.fn()
  })

  it('xử lý AppError: trả về đúng statusCode và message', () => {
    const error = new AppError('Tài nguyên không tồn tại', 404)

    errorMiddleware(error, req as Request, res as Response, next)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Tài nguyên không tồn tại'
    })
  })

  it('xử lý các lỗi thông thường không xác định: trả về status 500 và thông báo thân thiện', () => {
    const unexpectedError = new Error('Database connection crashed')

    errorMiddleware(unexpectedError, req as Request, res as Response, next)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Đã có lỗi xảy ra, vui lòng thử lại'
    })
  })

  it('xử lý lỗi PayloadTooLargeError (413): trả về status 413 và thông báo kích thước dữ liệu', () => {
    const payloadError = Object.assign(new Error('request entity too large'), {
      status: 413,
      type: 'entity.too.large'
    })

    errorMiddleware(payloadError, req as Request, res as Response, next)

    expect(res.status).toHaveBeenCalledWith(413)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message:
        'Dữ liệu gửi lên vượt quá dung lượng cho phép. Vui lòng giảm kích thước bản lưu hoặc tệp tải lên.'
    })
  })
})
