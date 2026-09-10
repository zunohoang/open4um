import { AppError } from '@/utils/AppError'

describe('AppError', () => {
  it('tạo instance AppError kế thừa Error với message và statusCode mặc định là 400', () => {
    const error = new AppError('Dữ liệu không hợp lệ')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(AppError)
    expect(error.message).toBe('Dữ liệu không hợp lệ')
    expect(error.statusCode).toBe(400)
  })

  it('gán đúng custom statusCode khi truyền vào', () => {
    const error404 = new AppError('Không tìm thấy tài nguyên', 404)
    expect(error404.statusCode).toBe(404)
    expect(error404.message).toBe('Không tìm thấy tài nguyên')

    const error401 = new AppError('Chưa xác thực', 401)
    expect(error401.statusCode).toBe(401)

    const error403 = new AppError('Không có quyền truy cập', 403)
    expect(error403.statusCode).toBe(403)
  })
})
