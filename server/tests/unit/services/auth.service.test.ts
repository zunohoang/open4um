import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { register, login, refresh, logout } from '@/services/auth.service'

// Mock bcrypt để tăng tốc độ test và tránh tốn CPU hashing
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn()
}))

const mockUserFindOne = jest.fn()
const mockUserFindById = jest.fn()
const mockUserCreate = jest.fn()
const mockRedisGet = jest.fn()
const mockRedisSet = jest.fn()

jest.mock('@/models/user.model', () => ({
  UserModel: {
    findOne: (...args: any[]) => mockUserFindOne(...args),
    findById: (...args: any[]) => mockUserFindById(...args),
    create: (...args: any[]) => mockUserCreate(...args)
  }
}))

jest.mock('@/lib/redis', () => ({
  redis: {
    get: (...args: any[]) => mockRedisGet(...args),
    set: (...args: any[]) => mockRedisSet(...args)
  }
}))

jest.mock('@/services/admin.service', () => ({
  getCreditConfig: jest.fn().mockResolvedValue({
    signupBonus: 20
  })
}))

describe('auth.service unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('register', () => {
    it('ném lỗi 409 khi email đã tồn tại trong hệ thống', async () => {
      mockUserFindOne.mockResolvedValue({
        _id: 'u1',
        email: 'test@example.com'
      })

      await expect(
        register('Nguyen Van A', 'test@example.com', 'pass123')
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'Email đã được sử dụng'
      })
    })

    it('đăng ký thành công: mã hóa mật khẩu, tạo user và trả về tokens cùng thông tin user', async () => {
      mockUserFindOne.mockResolvedValue(null)
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password_xyz')

      const fakeCreatedUser = {
        _id: 'user-new-id',
        name: 'Nguyen Van A',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        creditBalance: 20
      }
      mockUserCreate.mockResolvedValue(fakeCreatedUser)

      const result = await register(
        'Nguyen Van A',
        'test@example.com',
        'password123'
      )

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10)
      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Nguyen Van A',
          email: 'test@example.com',
          passwordHash: 'hashed_password_xyz',
          creditBalance: 20
        })
      )
      expect(result.user).toEqual({
        id: 'user-new-id',
        name: 'Nguyen Van A',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        creditBalance: 20
      })
      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
    })
  })

  describe('login', () => {
    it('ném lỗi 401 khi không tìm thấy email', async () => {
      mockUserFindOne.mockResolvedValue(null)

      await expect(
        login('notfound@example.com', 'password123')
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Email hoặc mật khẩu không đúng'
      })
    })

    it('ném lỗi 401 khi mật khẩu không đúng', async () => {
      mockUserFindOne.mockResolvedValue({
        _id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'mocked_hash'
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      await expect(
        login('user@example.com', 'wrong_password')
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Email hoặc mật khẩu không đúng'
      })
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrong_password',
        'mocked_hash'
      )
    })

    it('ném lỗi 403 khi tài khoản bị khóa', async () => {
      mockUserFindOne.mockResolvedValue({
        _id: 'user-1',
        email: 'locked@example.com',
        passwordHash: 'mocked_hash',
        status: 'locked'
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      await expect(
        login('locked@example.com', 'correct_password')
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('khóa')
      })
    })

    it('đăng nhập thành công trả về thông tin user và cặp tokens', async () => {
      mockUserFindOne.mockResolvedValue({
        _id: 'user-1',
        name: 'User One',
        email: 'user@example.com',
        passwordHash: 'mocked_hash',
        role: 'user',
        status: 'active',
        creditBalance: 50
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      const result = await login('user@example.com', 'correct_password')

      expect(result.user.email).toBe('user@example.com')
      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
    })
  })

  describe('refresh', () => {
    it('ném lỗi 401 khi refreshToken không đúng định dạng hoặc sai chữ ký', async () => {
      await expect(refresh('invalid.jwt.token')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Refresh token không hợp lệ'
      })
    })

    it('ném lỗi 401 khi refreshToken đã hết hạn (TokenExpiredError)', async () => {
      const expiredToken = jwt.sign(
        { id: 'u1', role: 'user', type: 'refresh', jti: 'jti-123' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1s' }
      )

      await expect(refresh(expiredToken)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Refresh token đã hết hạn, vui lòng đăng nhập lại'
      })
    })

    it('ném lỗi 401 khi token payload có type không phải refresh (ví dụ truyền nhầm access token)', async () => {
      const accessPayload = { id: 'u1', role: 'user', type: 'access' }
      const accessToken = jwt.sign(accessPayload, process.env.JWT_SECRET!)

      await expect(refresh(accessToken)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Refresh token không hợp lệ'
      })
    })

    it('ném lỗi 401 khi token đã bị thu hồi trong Redis blacklist', async () => {
      const payload = {
        id: 'u1',
        role: 'user',
        type: 'refresh',
        jti: 'blacklisted-jti'
      }
      const token = jwt.sign(payload, process.env.JWT_SECRET!)
      mockRedisGet.mockResolvedValue('1') // Blacklisted

      await expect(refresh(token)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Refresh token đã bị thu hồi'
      })
      expect(mockRedisGet).toHaveBeenCalledWith('blacklist:blacklisted-jti')
    })

    it('ném lỗi 401 khi tài khoản người dùng không còn tồn tại trong DB', async () => {
      const payload = {
        id: 'deleted-user',
        role: 'user',
        type: 'refresh',
        jti: 'valid-jti'
      }
      const token = jwt.sign(payload, process.env.JWT_SECRET!)
      mockRedisGet.mockResolvedValue(null)
      mockUserFindById.mockResolvedValue(null)

      await expect(refresh(token)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Tài khoản không tồn tại'
      })
    })

    it('ném lỗi 403 khi tài khoản người dùng đã bị khóa (status: locked)', async () => {
      const payload = {
        id: 'u1',
        role: 'user',
        type: 'refresh',
        jti: 'valid-jti'
      }
      const token = jwt.sign(payload, process.env.JWT_SECRET!)
      mockRedisGet.mockResolvedValue(null)
      mockUserFindById.mockResolvedValue({
        _id: 'u1',
        role: 'user',
        status: 'locked'
      })

      await expect(refresh(token)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('khóa')
      })
    })

    it('cấp mới accessToken khi refreshToken hợp lệ, chưa bị blacklist và user active', async () => {
      const payload = {
        id: 'u1',
        role: 'user',
        type: 'refresh',
        jti: 'token-uuid-123'
      }
      const token = jwt.sign(payload, process.env.JWT_SECRET!)
      mockRedisGet.mockResolvedValue(null)
      mockUserFindById.mockResolvedValue({
        _id: 'u1',
        role: 'user',
        status: 'active'
      })

      const result = await refresh(token)

      expect(result).toHaveProperty('accessToken')
      const decoded = jwt.verify(
        result.accessToken,
        process.env.JWT_SECRET!
      ) as any
      expect(decoded.id).toBe('u1')
      expect(decoded.type).toBe('access')
    })
  })

  describe('logout', () => {
    it('thêm jti của refreshToken vào danh sách blacklist trong redis với TTL 7 ngày', async () => {
      const payload = {
        id: 'u1',
        role: 'user',
        type: 'refresh',
        jti: 'token-uuid-123'
      }
      const token = jwt.sign(payload, process.env.JWT_SECRET!)

      const result = await logout(token)

      expect(mockRedisSet).toHaveBeenCalledWith(
        'blacklist:token-uuid-123',
        '1',
        'EX',
        7 * 24 * 60 * 60
      )
      expect(result).toEqual({ message: 'Đăng xuất thành công' })
    })

    it('xử lý an toàn (idempotent) khi token không hợp lệ: không văng lỗi và không gọi Redis', async () => {
      const result = await logout('malformed_token')

      expect(mockRedisSet).not.toHaveBeenCalled()
      expect(result).toEqual({ message: 'Đăng xuất thành công' })
    })

    it('không blacklist token nếu payload type không phải refresh (ví dụ token access)', async () => {
      const accessPayload = { id: 'u1', role: 'user', type: 'access' }
      const token = jwt.sign(accessPayload, process.env.JWT_SECRET!)

      const result = await logout(token)

      expect(mockRedisSet).not.toHaveBeenCalled()
      expect(result).toEqual({ message: 'Đăng xuất thành công' })
    })
  })
})
