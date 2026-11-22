import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '@/app'
import { qaRouter } from '@/routes/qa.routes'
import { errorMiddleware } from '@/middlewares/error.middleware'
import {
  requestContext,
  requestContextMiddleware
} from '@/middlewares/requestContext.middleware'
import { env } from '@/config/env'
import { getFault } from '@/services/qa.service'
import { getImage, uploadImage } from '@/lib/storage'

const entries = new Map<string, string>()
const idA = 'a'.repeat(24)
const idB = 'b'.repeat(24)
const mockGet = jest.fn(async (key: string) => entries.get(key) ?? null)
const mockPut = jest.fn()
const mockStat = jest.fn()
let mockRole = 'admin'
jest.mock('@/lib/redis', () => ({
  redis: {
    get: (key: string) => mockGet(key),
    set: async (key: string, value: string) => {
      entries.set(key, value)
      return 'OK'
    },
    del: async (key: string) => Number(entries.delete(key)),
    ttl: async () => 600,
    scan: async () => ['0', [...entries.keys()]]
  }
}))
jest.mock('@/lib/minio', () => ({
  BUCKET_MEDIA: 'media',
  minioClient: {
    putObject: (...args: unknown[]) => mockPut(...args),
    statObject: (...args: unknown[]) => mockStat(...args)
  }
}))
jest.mock('@/models/user.model', () => ({
  UserModel: {
    findById: () => ({
      select: async () => ({
        status: 'active',
        tokenVersion: 0,
        role: mockRole
      })
    }),
    findOne: ({ email }: { email: string }) => ({
      select: () => ({
        lean: async () => (email === 'qa@example.com' ? { _id: idA } : null)
      })
    })
  }
}))

const enabled = express()
enabled.use(requestContextMiddleware, express.json())
enabled.use('/api/v1/qa', qaRouter)
enabled.use(errorMiddleware)
const auth = () =>
  'Bearer ' +
  jwt.sign(
    { id: idA, role: mockRole, sessionId: 'session1', type: 'access' },
    env.JWT_SECRET
  )
const url = '/api/v1/qa/faults'
const image =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4Y6MBAAM4AUGx7UnvAAAAAElFTkSuQmCC'
describe('QA theo tài khoản', () => {
  beforeEach(() => {
    entries.clear()
    jest.clearAllMocks()
    mockRole = 'admin'
    env.QA_FAULTS_ENABLED = true
  })
  afterEach(() => {
    env.QA_FAULTS_ENABLED = false
  })
  it('không mount khi tắt, bỏ qua Redis trong getFault', async () => {
    env.QA_FAULTS_ENABLED = false
    await request(app).get(url).expect(404)
    expect(await getFault('ai_delay', idA)).toBeUndefined()
    expect(mockGet).not.toHaveBeenCalled()
  })
  it('chỉ quản trị viên được đặt công tắc', async () => {
    await request(enabled).get(url).expect(401)
    mockRole = 'user'
    await request(enabled).get(url).set('Authorization', auth()).expect(403)
  })
  it.each([
    { fault: 'bad', params: {} },
    { fault: 'ai_delay', params: { delayMs: 999 } },
    { fault: 'ai_error', params: { status: 401 } },
    { fault: 'invalid_output', params: { kind: 'xml' } }
  ])('từ chối fault/params không hợp lệ', async (input) => {
    await request(enabled)
      .put(url)
      .set('Authorization', auth())
      .send({ ...input, targetEmail: 'qa@example.com' })
      .expect(422)
  })
  it.each([
    ['ai_delay', { delayMs: 1000 }],
    ['ai_error', { status: 503 }],
    ['storage_down', {}],
    ['invalid_output', { kind: 'json' }]
  ] as const)('giới hạn TTL và cô lập %s', async (fault, params) => {
    const created = await request(enabled)
      .put(url)
      .set('Authorization', auth())
      .send({ fault, params, ttlSec: 5000, targetEmail: 'qa@example.com' })
      .expect(200)
    expect(created.body.data.expiresInSec).toBe(1800)
    expect(await getFault(fault, idA)).toEqual(params)
    expect(await getFault(fault, idB)).toBeUndefined()
    const list = await request(enabled)
      .get(url)
      .set('Authorization', auth())
      .expect(200)
    expect(list.body.data.active).toHaveLength(1)
    const cleared = await request(enabled)
      .delete(url)
      .set('Authorization', auth())
      .query({ fault, targetEmail: 'qa@example.com' })
      .expect(200)
    expect(cleared.body.data.cleared).toBe(1)
    expect(await getFault(fault, idA)).toBeUndefined()
  })
  it('storage_down trả 503 cho upload và đọc của A, B tiếp tục upload', () =>
    requestContext.run({ requestId: 'storage-test' }, async () => {
      await request(enabled)
        .put(url)
        .set('Authorization', auth())
        .send({ fault: 'storage_down', targetEmail: 'qa@example.com' })
        .expect(200)
      const error = {
        statusCode: 503,
        message:
          'Dịch vụ lưu trữ tệp tạm thời không phản hồi. Vui lòng thử lại sau.'
      }
      await expect(uploadImage(idA, image)).rejects.toMatchObject(error)
      await expect(
        getImage(`images/${idA}/00000000-0000-0000-0000-000000000000.png`)
      ).rejects.toMatchObject(error)
      expect(mockPut).not.toHaveBeenCalled()
      await uploadImage(idB, image)
      expect(mockPut).toHaveBeenCalledTimes(1)
      mockStat.mockRejectedValue(
        Object.assign(new Error(), { code: 'ECONNREFUSED' })
      )
      await expect(
        getImage(`images/${idB}/00000000-0000-0000-0000-000000000000.png`)
      ).rejects.toMatchObject(error)
    }))
  it('invalid_output không gửi params thì mặc định kind schema', async () => {
    await request(enabled)
      .put(url)
      .set('Authorization', auth())
      .send({ fault: 'invalid_output', targetEmail: 'qa@example.com' })
      .expect(200)
    expect(await getFault('invalid_output', idA)).toEqual({ kind: 'schema' })
  })
  it('404 cho email hoặc mã tác vụ chưa tồn tại, giữ request ID hợp lệ', async () => {
    await request(enabled)
      .put(url)
      .set('Authorization', auth())
      .send({ fault: 'storage_down', targetEmail: 'missing@example.com' })
      .expect(404)
    await request(enabled)
      .get('/api/v1/qa/ai-tasks/unknown-request')
      .set('Authorization', auth())
      .set('X-Request-Id', 'client-id-123')
      .expect('X-Request-Id', 'client-id-123')
      .expect(404)
  })
})
