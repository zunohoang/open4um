import { ZodError } from 'zod'
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  parseEnv
} from '@/config/env'

const baseEnv = {
  NODE_ENV: 'production',
  PORT: '4000',
  MONGO_URI: 'mongodb://localhost:27017/abslider',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'test-jwt-secret-key-at-least-16-chars',
  GEMINI_API_KEY: 'test-gemini-key',
  MINIO_ENDPOINT: 'localhost:9000',
  MINIO_ACCESS_KEY: 'minio-user',
  MINIO_SECRET_KEY: 'minio-password',
  RESEND_API_KEY: 'test-resend-key',
  RESEND_FROM_EMAIL: 'test@example.com'
}

const issuePaths = (error: unknown) => {
  if (!(error instanceof ZodError)) return []
  return error.issues.map((issue) => issue.path.join('.'))
}

describe('production admin environment', () => {
  it('bắt buộc ADMIN_EMAIL và ADMIN_PASSWORD trong production', () => {
    try {
      parseEnv(baseEnv)
      throw new Error('Expected environment validation to fail')
    } catch (error) {
      expect(issuePaths(error)).toEqual(
        expect.arrayContaining(['ADMIN_EMAIL', 'ADMIN_PASSWORD'])
      )
    }
  })

  it('từ chối credential admin mặc định trong production', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        ADMIN_EMAIL: DEFAULT_ADMIN_EMAIL,
        ADMIN_PASSWORD: DEFAULT_ADMIN_PASSWORD
      })
    ).toThrow(ZodError)
  })

  it('từ chối mật khẩu production không đủ độ mạnh', () => {
    try {
      parseEnv({
        ...baseEnv,
        ADMIN_EMAIL: 'owner@example.com',
        ADMIN_PASSWORD: 'onlylowercase'
      })
      throw new Error('Expected environment validation to fail')
    } catch (error) {
      expect(issuePaths(error)).toContain('ADMIN_PASSWORD')
    }
  })

  it('chấp nhận credential mạnh và chuẩn hóa email production', () => {
    const result = parseEnv({
      ...baseEnv,
      ADMIN_EMAIL: '  Owner@Example.com ',
      ADMIN_PASSWORD: 'Strong!Password123'
    })

    expect(result.ADMIN_EMAIL).toBe('owner@example.com')
    expect(result.ADMIN_PASSWORD).toBe('Strong!Password123')
  })

  it('giữ fallback seed mặc định cho development khi biến admin để trống', () => {
    const result = parseEnv({
      ...baseEnv,
      NODE_ENV: 'development',
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD: ''
    })

    expect(result.ADMIN_EMAIL).toBeUndefined()
    expect(result.ADMIN_PASSWORD).toBeUndefined()
    expect(result.ADMIN_NAME).toBe('Admin ABSlider')
    expect(result.ADMIN_CREDIT_BALANCE).toBe(1000)
  })
})
