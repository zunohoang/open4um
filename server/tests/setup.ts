process.env.NODE_ENV = 'test'
process.env.PORT = '4000'
process.env.MONGO_URI = 'mongodb://localhost:27017'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.JWT_SECRET = 'test-jwt-secret-key-at-least-16-chars'
process.env.GEMINI_API_KEY = 'test-gemini-key'
process.env.MINIO_ENDPOINT = 'localhost'
process.env.MINIO_ACCESS_KEY = 'minioadmin'
process.env.MINIO_SECRET_KEY = 'minioadmin'
process.env.RESEND_API_KEY = 'test-resend-key'
process.env.RESEND_FROM_EMAIL = 'test@resend.dev'
process.env.ENABLE_EMAIL_VERIFICATION = 'true'

// Mock pino logger để tránh output thừa trong test run
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn()
  }
}))
