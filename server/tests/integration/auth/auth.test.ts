import request from 'supertest'
import bcrypt from 'bcrypt'
import { app } from '@/app'
import { setupTestDb } from '../testDb'
import { UserModel } from '@/models/user.model'
import { redis } from '@/lib/redis'
import * as emailService from '@/services/email.service'

jest.mock('@/services/email.service', () => ({
  sendRegisterOtp: jest.fn().mockResolvedValue(undefined),
  sendForgotPasswordOtp: jest.fn().mockResolvedValue(undefined)
}))

describe('Integration Tests — Auth Routes (/api/v1/auth)', () => {
  setupTestDb()

  describe('POST /api/v1/auth/send-register-otp', () => {
    it('trả 422 khi email không hợp lệ', async () => {
      const res = await request(app)
        .post('/api/v1/auth/send-register-otp')
        .send({ email: 'not-an-email' })

      expect(res.status).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('trả 200 và sinh mã OTP lưu thực tế vào Redis khi email hợp lệ', async () => {
      const res = await request(app)
        .post('/api/v1/auth/send-register-otp')
        .send({ email: 'test@example.com' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const storedOtp = await redis.get('otp:register:test@example.com')
      expect(storedOtp).not.toBeNull()
      expect(storedOtp).toMatch(/^\d{6}$/)
      expect(emailService.sendRegisterOtp).toHaveBeenCalledWith(
        'test@example.com',
        storedOtp
      )
    })

    it('trả 409 khi email đã tồn tại trong Database', async () => {
      await UserModel.create({
        name: 'Existing User',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        role: 'user'
      })

      const res = await request(app)
        .post('/api/v1/auth/send-register-otp')
        .send({ email: 'test@example.com' })

      expect(res.status).toBe(409)
      expect(res.body.success).toBe(false)
    })
  })

  describe('POST /api/v1/auth/send-register-otp', () => {
    it('trả 422 khi email không hợp lệ', async () => {
      const res = await request(app)
        .post('/api/v1/auth/send-register-otp')
        .send({ email: 'not-an-email' })

      expect(res.status).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('trả 200 và thông báo khi gửi OTP thành công', async () => {
      mockedAuthService.sendRegisterOtp.mockResolvedValue({
        message: 'Mã xác thực đã được gửi đến email của bạn'
      })

      const res = await request(app)
        .post('/api/v1/auth/send-register-otp')
        .send({ email: 'test@example.com' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(mockedAuthService.sendRegisterOtp).toHaveBeenCalledWith(
        'test@example.com'
      )
    })
  })

  describe('POST /api/v1/auth/register', () => {
    it('trả 422 khi dữ liệu đầu vào không hợp lệ', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'A',
        email: 'invalid-email',
        password: '123'
      })

      expect(res.status).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('trả 400 khi mã OTP không chính xác hoặc chưa được gửi', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Nguyen Van A',
        email: 'test@example.com',
        password: 'password123',
        otp: '999999'
      })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('trả 201 và tạo người dùng thành công trong MongoDB khi OTP hợp lệ', async () => {
      await redis.set('otp:register:test@example.com', '123456')

      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Nguyen Van A',
        email: 'test@example.com',
        password: 'password123',
        otp: '123456'
      })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.user.email).toBe('test@example.com')
      expect(res.body.data.accessToken).toBeTruthy()
      expect(res.body.data.refreshToken).toBeTruthy()

      const userInDb = await UserModel.findOne({ email: 'test@example.com' })
      expect(userInDb).not.toBeNull()
      expect(userInDb?.name).toBe('Nguyen Van A')

      const isMatch = await bcrypt.compare(
        'password123',
        userInDb!.passwordHash
      )
      expect(isMatch).toBe(true)

      const otpAfter = await redis.get('otp:register:test@example.com')
      expect(otpAfter).toBeNull()
    })
  })

  describe('POST /api/v1/auth/login', () => {
    it('trả 401 khi mật khẩu không chính xác', async () => {
      const passwordHash = await bcrypt.hash('password123', 10)
      await UserModel.create({
        name: 'Login User',
        email: 'login@example.com',
        passwordHash,
        role: 'user',
        status: 'active'
      })

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'login@example.com',
        password: 'wrong_password'
      })

      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
    })

    it('trả 200 và cấp tokens khi đăng nhập thành công với thông tin đúng', async () => {
      const passwordHash = await bcrypt.hash('password123', 10)
      await UserModel.create({
        name: 'Login User',
        email: 'login@example.com',
        passwordHash,
        role: 'user',
        status: 'active'
      })

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'login@example.com',
        password: 'password123'
      })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.accessToken).toBeTruthy()
      expect(res.body.data.refreshToken).toBeTruthy()
      expect(res.body.data.user.email).toBe('login@example.com')
    })
  })

  describe('POST /api/v1/auth/refresh & POST /api/v1/auth/logout', () => {
    it('POST /api/v1/auth/refresh cấp accessToken mới từ refreshToken hợp lệ', async () => {
      const passwordHash = await bcrypt.hash('password123', 10)
      await UserModel.create({
        name: 'Token User',
        email: 'token@example.com',
        passwordHash,
        role: 'user',
        status: 'active'
      })

      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'token@example.com',
        password: 'password123'
      })
      const refreshToken = loginRes.body.data.refreshToken

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.accessToken).toBeTruthy()
    })

    it('POST /api/v1/auth/logout đưa refreshToken vào blacklist trong Redis', async () => {
      const passwordHash = await bcrypt.hash('password123', 10)
      await UserModel.create({
        name: 'Token User',
        email: 'token@example.com',
        passwordHash,
        role: 'user',
        status: 'active'
      })

      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'token@example.com',
        password: 'password123'
      })
      const refreshToken = loginRes.body.data.refreshToken

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })

      expect(refreshRes.status).toBe(401)
    })
  })

  describe('POST /api/v1/auth/forgot-password', () => {
    it('trả 422 khi email sai định dạng', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'wrong-email' })

      expect(res.status).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('trả 200 và sinh OTP đặt lại mật khẩu trong Redis khi người dùng tồn tại', async () => {
      await UserModel.create({
        name: 'Forgot User',
        email: 'user@example.com',
        passwordHash: 'hashed',
        role: 'user'
      })

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'user@example.com' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const storedOtp = await redis.get('otp:forgot:user@example.com')
      expect(storedOtp).not.toBeNull()
      expect(storedOtp).toMatch(/^\d{6}$/)
    })
  })

  describe('POST /api/v1/auth/reset-password', () => {
    it('trả 422 khi dữ liệu đầu vào không hợp lệ (mật khẩu ngắn hoặc OTP sai định dạng)', async () => {
      const res = await request(app).post('/api/v1/auth/reset-password').send({
        email: 'user@example.com',
        otp: '123',
        password: '123'
      })

      expect(res.status).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('trả 400 khi mã OTP không chính xác hoặc đã hết hạn trong Redis', async () => {
      await UserModel.create({
        name: 'Reset User',
        email: 'reset@example.com',
        passwordHash: 'hashed',
        role: 'user'
      })

      const res = await request(app).post('/api/v1/auth/reset-password').send({
        email: 'reset@example.com',
        otp: '999999',
        password: 'new_password_123'
      })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('trả 200 và cập nhật mật khẩu mới thành công khi OTP hợp lệ', async () => {
      const oldHash = await bcrypt.hash('old_password_123', 10)
      await UserModel.create({
        name: 'Reset User',
        email: 'reset@example.com',
        passwordHash: oldHash,
        role: 'user'
      })

      await redis.set('otp:forgot:reset@example.com', '654321', 'EX', 300)

      const res = await request(app).post('/api/v1/auth/reset-password').send({
        email: 'reset@example.com',
        otp: '654321',
        password: 'new_password_123'
      })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const otpInRedis = await redis.get('otp:forgot:reset@example.com')
      expect(otpInRedis).toBeNull()

      const failLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'reset@example.com',
        password: 'old_password_123'
      })
      expect(failLogin.status).toBe(401)

      const successLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'reset@example.com',
        password: 'new_password_123'
      })
      expect(successLogin.status).toBe(200)
      expect(successLogin.body.data.accessToken).toBeTruthy()
    })
  })
})
