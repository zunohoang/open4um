import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '@/app'
import * as authService from '@/services/auth.service'
import { AppError } from '@/utils/AppError'

jest.mock('@/services/auth.service')

describe('Integration Tests — Auth Routes (/api/v1/auth)', () => {
  const mockedAuthService = jest.mocked(authService)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/v1/auth/register', () => {
    it('trả 422 khi dữ liệu đầu vào không hợp lệ (thiếu email, mật khẩu ngắn)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'A',
        email: 'invalid-email',
        password: '123'
      })

      expect(res.status).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('trả 201 và thông tin người dùng khi đăng ký thành công', async () => {
      const mockResult = {
        user: {
          id: 'u1',
          name: 'Nguyen Van A',
          email: 'test@example.com',
          role: 'user' as const,
          status: 'active' as const,
          creditBalance: 20
        },
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token'
      }
      mockedAuthService.register.mockResolvedValue(mockResult)

      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Nguyen Van A',
        email: 'test@example.com',
        password: 'password123'
      })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.user.email).toBe('test@example.com')
      expect(res.body.data.accessToken).toBe('mock_access_token')
    })
  })

  describe('POST /api/v1/auth/login', () => {
    it('trả 401 khi tài khoản hoặc mật khẩu không chính xác', async () => {
      mockedAuthService.login.mockRejectedValue(
        new AppError('Email hoặc mật khẩu không đúng', 401)
      )

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'wrong@example.com',
        password: 'wrong_password'
      })

      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain('không đúng')
    })

    it('trả 200 và tokens khi đăng nhập thành công', async () => {
      mockedAuthService.login.mockResolvedValue({
        user: {
          id: 'u1',
          name: 'Nguyen Van A',
          email: 'user@example.com',
          role: 'user' as const,
          status: 'active' as const,
          creditBalance: 20
        },
        accessToken: 'access_123',
        refreshToken: 'refresh_123'
      })

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'user@example.com',
        password: 'password123'
      })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.accessToken).toBe('access_123')
    })
  })

  describe('GET /api/v1/auth/me', () => {
    it('trả 401 khi không truyền token xác thực', async () => {
      const res = await request(app).get('/api/v1/auth/me')

      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
    })

    it('trả 200 và thông tin profile khi có Bearer token hợp lệ', async () => {
      const validToken = jwt.sign(
        { id: 'user-me-123', role: 'user', type: 'access' },
        process.env.JWT_SECRET!
      )

      mockedAuthService.getProfile.mockResolvedValue({
        id: 'user-me-123',
        name: 'User Logged In',
        email: 'logged@example.com',
        role: 'user',
        status: 'active',
        creditBalance: 100
      })

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBe('user-me-123')
      expect(mockedAuthService.getProfile).toHaveBeenCalledWith('user-me-123')
    })
  })
})
