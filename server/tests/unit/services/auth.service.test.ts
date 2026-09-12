import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import {
  sendRegisterOtp,
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  updateProfile,
  resetPassword
} from '@/services/auth.service'
import * as emailService from '@/services/email.service'

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
const mockRedisDel = jest.fn()
const mockRedisTtl = jest.fn()
const mockRedisIncr = jest.fn()
const mockRedisExpire = jest.fn()

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
    set: (...args: any[]) => mockRedisSet(...args),
    del: (...args: any[]) => mockRedisDel(...args),
    ttl: (...args: any[]) => mockRedisTtl(...args),
    incr: (...args: any[]) => mockRedisIncr(...args),
    expire: (...args: any[]) => mockRedisExpire(...args)
  }
}))

jest.mock('@/services/admin.service', () => ({
  getCreditConfig: jest.fn().mockResolvedValue({
    signupBonus: 20
  })
}))

jest.mock('@/services/email.service', () => ({
  sendRegisterOtp: jest.fn().mockResolvedValue(undefined),
  sendForgotPasswordOtp: jest.fn().mockResolvedValue(undefined)
}))

describe('auth.service unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('sendRegisterOtp', () => {
    it('ném lỗi 409 khi email đã tồn tại trong hệ thống', async () => {
      mockUserFindOne.mockResolvedValue({
        _id: 'u1',
        email: 'test@example.com'
      })

      await expect(sendRegisterOtp('test@example.com')).rejects.toMatchObject({
        statusCode: 409,
        message: 'Email đã được sử dụng'
      })
    })

    it('ném lỗi 429 khi đang trong thời gian cooldown 60s', async () => {
      mockUserFindOne.mockResolvedValue(null)
      mockRedisGet.mockResolvedValue('1')

      await expect(sendRegisterOtp('test@example.com')).rejects.toMatchObject({
        statusCode: 429,
        message: expect.stringContaining('60 giây')
      })
    })

    it('tạo mã OTP, lưu Redis và gửi email thành công', async () => {
      mockUserFindOne.mockResolvedValue(null)
      mockRedisGet.mockResolvedValue(null)
      mockRedisSet.mockResolvedValue('OK')

      const result = await sendRegisterOtp('test@example.com')

      expect(mockRedisSet).toHaveBeenCalledWith(
        'otp:register:test@example.com',
        expect.stringMatching(/^\d{6}$/),
        'EX',
        300
      )
      expect(mockRedisSet).toHaveBeenCalledWith(
        'otp:cooldown:register:test@example.com',
        '1',
        'EX',
        60
      )
      expect(emailService.sendRegisterOtp).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringMatching(/^\d{6}$/)
      )
      expect(result.message).toContain('Mã xác thực đã được gửi')
    })
  })

  describe('register', () => {
    it('ném lỗi 409 khi email đã tồn tại trong hệ thống', async () => {
      mockUserFindOne.mockResolvedValue({
        _id: 'u1',
        email: 'test@example.com'
      })

      await expect(
        register('Nguyen Van A', 'test@example.com', 'pass123', '123456')
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'Email đã được sử dụng'
      })
    })

    it('ném lỗi 400 khi mã OTP không khớp hoặc đã hết hạn', async () => {
      mockUserFindOne.mockResolvedValue(null)
      mockRedisGet.mockResolvedValue(null)

      await expect(
        register('Nguyen Van A', 'test@example.com', 'pass123', '123456')
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Mã OTP')
      })

      mockRedisGet.mockResolvedValue('654321')
      await expect(
        register('Nguyen Van A', 'test@example.com', 'pass123', '123456')
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Mã OTP')
      })
    })

    it('đăng ký thành công: mã hóa mật khẩu, tạo user và trả về tokens cùng thông tin user', async () => {
      mockUserFindOne.mockResolvedValue(null)
      mockRedisGet.mockResolvedValue('123456')
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
        'password123',
        '123456'
      )

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10)
      expect(mockRedisDel).toHaveBeenCalledWith('otp:register:test@example.com')
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
        creditBalance: 20,
        avatar: null
      })
      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
    })
  })

  describe('forgotPassword', () => {
    it('ném lỗi 404 khi email không tồn tại', async () => {
      mockUserFindOne.mockResolvedValue(null)

      await expect(
        forgotPassword('notfound@example.com')
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('không tồn tại')
      })
    })

    it('ném lỗi 403 khi tài khoản bị khóa', async () => {
      mockUserFindOne.mockResolvedValue({
        _id: 'u1',
        email: 'locked@example.com',
        status: 'locked'
      })

      await expect(forgotPassword('locked@example.com')).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('khóa')
      })
    })

    it('ném lỗi 429 khi cooldown còn hiệu lực', async () => {
      mockUserFindOne.mockResolvedValue({
        _id: 'u1',
        email: 'valid@example.com',
        status: 'active'
      })
      mockRedisGet.mockResolvedValue('1')

      await expect(forgotPassword('valid@example.com')).rejects.toMatchObject({
        statusCode: 429,
        message: expect.stringContaining('60 giây')
      })
    })

    it('gửi OTP đặt lại mật khẩu thành công', async () => {
      mockUserFindOne.mockResolvedValue({
        _id: 'u1',
        email: 'valid@example.com',
        status: 'active'
      })
      mockRedisGet.mockResolvedValue(null)

      const result = await forgotPassword('valid@example.com')

      expect(mockRedisSet).toHaveBeenCalledWith(
        'otp:forgot:valid@example.com',
        expect.stringMatching(/^\d{6}$/),
        'EX',
        300
      )
      expect(emailService.sendForgotPasswordOtp).toHaveBeenCalledWith(
        'valid@example.com',
        expect.stringMatching(/^\d{6}$/)
      )
      expect(result.message).toContain('đặt lại mật khẩu')
    })
  })

  describe('resetPassword', () => {
    it('ném lỗi 404 khi không tìm thấy email', async () => {
      mockUserFindOne.mockResolvedValue(null)

      await expect(
        resetPassword('notfound@example.com', '123456', 'newpassword123')
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('không tồn tại')
      })
    })

    it('ném lỗi 403 khi tài khoản bị khóa', async () => {
      mockUserFindOne.mockResolvedValue({
        _id: 'u1',
        email: 'locked@example.com',
        status: 'locked'
      })

      await expect(
        resetPassword('locked@example.com', '123456', 'newpassword123')
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('khóa')
      })
    })

    it('ném lỗi 400 khi OTP không khớp hoặc hết hạn', async () => {
      mockUserFindOne.mockResolvedValue({
        _id: 'u1',
        email: 'valid@example.com',
        status: 'active'
      })
      mockRedisGet.mockResolvedValue(null)

      await expect(
        resetPassword('valid@example.com', '123456', 'newpassword123')
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining(
          'Mã OTP không chính xác hoặc đã hết hạn'
        )
      })
    })

    it('đặt lại mật khẩu thành công và xóa OTP trong Redis', async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined)
      mockUserFindOne.mockResolvedValue({
        _id: 'u1',
        email: 'valid@example.com',
        status: 'active',
        passwordHash: 'old_hash',
        save: mockSave
      })
      mockRedisGet.mockResolvedValue('123456')
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('new_hash_123')

      const result = await resetPassword(
        'valid@example.com',
        '123456',
        'newpassword123'
      )

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10)
      expect(mockSave).toHaveBeenCalled()
      expect(mockRedisDel).toHaveBeenCalledWith('otp:forgot:valid@example.com')
      expect(result.message).toContain('thành công')
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

  describe('updateProfile', () => {
    it('ném lỗi 404 khi tài khoản không tồn tại', async () => {
      mockUserFindById.mockResolvedValue(null)

      await expect(
        updateProfile('not-found', 'New Name')
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Tài khoản không tồn tại'
      })
    })

    it('không cập nhật DB và không tốn lượt khi tên mới giống hệt tên cũ', async () => {
      const mockSave = jest.fn()
      mockUserFindById.mockResolvedValue({
        _id: 'u1',
        name: 'Nguyen Van A',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        creditBalance: 20,
        save: mockSave
      })

      const result = await updateProfile('u1', '  Nguyen Van A  ')

      expect(mockSave).not.toHaveBeenCalled()
      expect(mockRedisGet).not.toHaveBeenCalled()
      expect(result.name).toBe('Nguyen Van A')
    })

    it('ném lỗi 429 khi người dùng đang trong thời gian cooldown giữa 2 lần đổi', async () => {
      mockUserFindById.mockResolvedValue({
        _id: 'u1',
        name: 'Old Name',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        creditBalance: 20
      })
      mockRedisGet.mockResolvedValueOnce('1') // Cooldown active
      mockRedisTtl.mockResolvedValueOnce(45)

      await expect(updateProfile('u1', 'Brand New Name')).rejects.toMatchObject(
        {
          statusCode: 429,
          message: expect.stringContaining('45 giây')
        }
      )
    })

    it('ném lỗi 429 khi vượt quá giới hạn 5 lần/giờ', async () => {
      mockUserFindById.mockResolvedValue({
        _id: 'u1',
        name: 'Old Name',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        creditBalance: 20
      })
      mockRedisGet.mockResolvedValueOnce(null) // Cooldown not active
      mockRedisGet.mockResolvedValueOnce('5') // Hourly count = 5
      mockRedisTtl.mockResolvedValueOnce(1800) // TTL 1800s = 30 minutes

      await expect(updateProfile('u1', 'Brand New Name')).rejects.toMatchObject(
        {
          statusCode: 429,
          message: expect.stringContaining('5 lần/giờ')
        }
      )
    })

    it('cập nhật tên thành công, lưu DB và thiết lập cooldown cùng bộ đếm trong Redis', async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined)
      const mockUser = {
        _id: 'u1',
        name: 'Old Name',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        creditBalance: 20,
        save: mockSave
      }
      mockUserFindById.mockResolvedValue(mockUser)
      mockRedisGet.mockResolvedValueOnce(null) // Cooldown not active
      mockRedisGet.mockResolvedValueOnce('2') // Hourly count = 2
      mockRedisIncr.mockResolvedValueOnce(3)

      const result = await updateProfile('u1', 'Updated Name')

      expect(mockUser.name).toBe('Updated Name')
      expect(mockSave).toHaveBeenCalled()
      expect(mockRedisSet).toHaveBeenCalledWith(
        'ratelimit:profile:cooldown:u1',
        '1',
        'EX',
        60
      )
      expect(mockRedisIncr).toHaveBeenCalledWith('ratelimit:profile:count:u1')
      expect(result.name).toBe('Updated Name')
    })

    it('ném lỗi 400 khi trường họ tên bị bỏ trống (Luồng 5b)', async () => {
      mockUserFindById.mockResolvedValue({
        _id: 'u1',
        name: 'Old Name',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        creditBalance: 20
      })

      await expect(updateProfile('u1', { name: '   ' })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Họ tên không được để trống'
      })
    })

    it('ném lỗi 400 khi ảnh đại diện sai định dạng hoặc vượt quá dung lượng (Luồng 5a)', async () => {
      mockUserFindById.mockResolvedValue({
        _id: 'u1',
        name: 'Old Name',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        creditBalance: 20
      })

      await expect(
        updateProfile('u1', {
          avatar: 'data:application/pdf;base64,JVBERi0xLjQK...'
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Ảnh vượt quá dung lượng cho phép hoặc sai định dạng tệp tin'
      })
    })

    it('cập nhật cả họ tên và ảnh đại diện thành công', async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined)
      const mockUser = {
        _id: 'u1',
        name: 'Old Name',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        creditBalance: 20,
        avatar: null,
        save: mockSave
      }
      mockUserFindById.mockResolvedValue(mockUser)
      mockRedisGet.mockResolvedValueOnce(null)
      mockRedisGet.mockResolvedValueOnce('0')
      mockRedisIncr.mockResolvedValueOnce(1)

      const validAvatar =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const result = await updateProfile('u1', {
        name: 'New Name',
        avatar: validAvatar
      })

      expect(mockUser.name).toBe('New Name')
      expect(mockUser.avatar).toBe(validAvatar)
      expect(result.avatar).toBe(validAvatar)
    })
  })
})
