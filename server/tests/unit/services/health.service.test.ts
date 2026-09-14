import mongoose from 'mongoose'
import { redis } from '@/lib/redis'
import { minioClient } from '@/lib/minio'
import { getReadiness, setShuttingDown } from '@/services/health.service'

jest.mock('mongoose', () => ({
  __esModule: true,
  default: {
    connection: {
      readyState: 1,
      db: {
        admin: () => ({ command: jest.fn().mockResolvedValue({ ok: 1 }) })
      }
    }
  }
}))

jest.mock('@/lib/redis', () => ({
  redis: { ping: jest.fn() }
}))

jest.mock('@/lib/minio', () => ({
  BUCKET_MEDIA: 'media',
  minioClient: { bucketExists: jest.fn() }
}))

const mockedRedisPing = jest.mocked(redis.ping)
const mockedBucketExists = jest.mocked(minioClient.bucketExists)

describe('health.service', () => {
  beforeEach(() => {
    setShuttingDown(false)
    mongoose.connection.readyState = 1
    mockedRedisPing.mockResolvedValue('PONG')
    mockedBucketExists.mockResolvedValue(true)
  })

  afterAll(() => setShuttingDown(false))

  it('trả ready khi MongoDB, Redis và MinIO đều hoạt động', async () => {
    await expect(getReadiness()).resolves.toEqual({
      status: 'ready',
      checks: { mongo: 'up', redis: 'up', minio: 'up' }
    })
  })

  it('đánh dấu đúng dependency bị lỗi và giữ kết quả các dependency khác', async () => {
    mockedRedisPing.mockRejectedValue(new Error('Redis unavailable'))

    await expect(getReadiness()).resolves.toEqual({
      status: 'not_ready',
      checks: { mongo: 'up', redis: 'down', minio: 'up' }
    })
  })

  it('trả not_ready ngay khi server bắt đầu shutdown', async () => {
    setShuttingDown(true)

    await expect(getReadiness()).resolves.toEqual({
      status: 'not_ready',
      checks: { mongo: 'down', redis: 'down', minio: 'down' }
    })
    expect(mockedRedisPing).not.toHaveBeenCalled()
    expect(mockedBucketExists).not.toHaveBeenCalled()
  })
})
