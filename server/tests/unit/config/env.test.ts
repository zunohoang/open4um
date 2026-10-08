import { ZodError } from 'zod'
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  parseEnv
} from '@/config/env'

const baseEnv = {
  NODE_ENV: 'production',
  PORT: '4000',
  RELEASE_SHA: '0123456789abcdef0123456789abcdef01234567',
  RELEASE_ENVIRONMENT: 'production',
  CORS_ALLOWED_ORIGINS:
    'https://slides.sbltcup.dev, https://slides-cup.sbltcup.dev',
  MONGO_URI: 'mongodb://localhost:27017/abslider',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'test-jwt-secret-key-at-least-16-chars',
  GEMINI_API_KEY: 'test-gemini-key',
  MINIO_ENDPOINT: 'localhost:9000',
  MINIO_USE_SSL: 'false',
  MINIO_PUBLIC_ENDPOINT: 'https://slides-media.sbltcup.dev',
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
    expect(result.CORS_ALLOWED_ORIGINS).toEqual([
      'https://slides.sbltcup.dev',
      'https://slides-cup.sbltcup.dev'
    ])
    expect(result.MINIO_USE_SSL).toBe(false)
  })

  it('từ chối origin CORS production không dùng HTTPS', () => {
    try {
      parseEnv({
        ...baseEnv,
        CORS_ALLOWED_ORIGINS: 'http://slides.sbltcup.dev',
        ADMIN_EMAIL: 'owner@example.com',
        ADMIN_PASSWORD: 'Strong!Password123'
      })
      throw new Error('Expected environment validation to fail')
    } catch (error) {
      expect(issuePaths(error)).toContain('CORS_ALLOWED_ORIGINS')
    }
  })

  it('bắt buộc public MinIO HTTPS endpoint trong production', () => {
    try {
      parseEnv({
        ...baseEnv,
        MINIO_PUBLIC_ENDPOINT: '',
        ADMIN_EMAIL: 'owner@example.com',
        ADMIN_PASSWORD: 'Strong!Password123'
      })
      throw new Error('Expected environment validation to fail')
    } catch (error) {
      expect(issuePaths(error)).toContain('MINIO_PUBLIC_ENDPOINT')
    }
  })

  it('bắt buộc release provenance hợp lệ trong production', () => {
    try {
      parseEnv({
        ...baseEnv,
        RELEASE_SHA: '',
        RELEASE_ENVIRONMENT: '',
        ADMIN_EMAIL: 'owner@example.com',
        ADMIN_PASSWORD: 'Strong!Password123'
      })
      throw new Error('Expected environment validation to fail')
    } catch (error) {
      expect(issuePaths(error)).toEqual(
        expect.arrayContaining(['RELEASE_SHA', 'RELEASE_ENVIRONMENT'])
      )
    }
  })

  it('từ chối release SHA sai định dạng', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        RELEASE_SHA: 'latest',
        ADMIN_EMAIL: 'owner@example.com',
        ADMIN_PASSWORD: 'Strong!Password123'
      })
    ).toThrow(ZodError)
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

  it('giữ model Google hiện tại khi không cấu hình AI provider', () => {
    const result = parseEnv({ ...baseEnv, NODE_ENV: 'test' })
    expect(result.GEMINI_BASE_URL).toBeUndefined()
    expect(result.GEMINI_MODEL).toBe('gemini-3.5-flash')
  })

  it('đọc endpoint và model ShopAIKey từ env', () => {
    const result = parseEnv({
      ...baseEnv,
      NODE_ENV: 'test',
      GEMINI_BASE_URL: 'https://api.shopaikey.com',
      GEMINI_MODEL: ' gemini-3.8-flash '
    })
    expect(result.GEMINI_BASE_URL).toBe('https://api.shopaikey.com')
    expect(result.GEMINI_MODEL).toBe('gemini-3.8-flash')
  })

  it('dùng fallback khi endpoint và model để trống', () => {
    const result = parseEnv({
      ...baseEnv,
      NODE_ENV: 'test',
      GEMINI_BASE_URL: '',
      GEMINI_MODEL: '   '
    })
    expect(result.GEMINI_BASE_URL).toBeUndefined()
    expect(result.GEMINI_MODEL).toBe('gemini-3.5-flash')
  })

  it.each([
    'not-a-url',
    'ftp://api.shopaikey.com',
    'http://api.shopaikey.com',
    'https://user:password@api.shopaikey.com',
    'https://api.shopaikey.com/v1beta',
    'https://api.shopaikey.com?key=secret',
    'https://api.shopaikey.com#fragment'
  ])('từ chối AI origin production không an toàn: %s', (origin) => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        ADMIN_EMAIL: 'owner@example.com',
        ADMIN_PASSWORD: 'Strong!Password123',
        GEMINI_BASE_URL: origin
      })
    ).toThrow(ZodError)
  })
})
