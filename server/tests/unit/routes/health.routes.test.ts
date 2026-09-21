import express from 'express'
import request from 'supertest'
import { getReadiness } from '@/services/health.service'
import { healthRouter } from '@/routes/health.routes'

jest.mock('@/services/health.service', () => ({
  getReadiness: jest.fn()
}))

const mockedGetReadiness = jest.mocked(getReadiness)
const app = express()
app.use('/api/v1', healthRouter)

describe('health routes', () => {
  it.each(['/api/v1/health', '/api/v1/health/live'])(
    'GET %s trả liveness mà không kiểm tra dependency',
    async (path) => {
      const response = await request(app).get(path)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        data: {
          status: 'ok',
          release: { sha: null, environment: null }
        }
      })
      expect(mockedGetReadiness).not.toHaveBeenCalled()
    }
  )

  it('GET /api/v1/version trả release metadata', async () => {
    const response = await request(app).get('/api/v1/version')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      success: true,
      data: { release: { sha: null, environment: null } }
    })
  })

  it('GET /api/v1/health/ready trả 200 khi mọi dependency hoạt động', async () => {
    mockedGetReadiness.mockResolvedValue({
      status: 'ready',
      checks: { mongo: 'up', redis: 'up', minio: 'up' }
    })

    const response = await request(app).get('/api/v1/health/ready')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      success: true,
      data: {
        status: 'ready',
        checks: { mongo: 'up', redis: 'up', minio: 'up' },
        release: { sha: null, environment: null }
      }
    })
  })

  it('GET /api/v1/health/ready trả 503 khi có dependency lỗi', async () => {
    mockedGetReadiness.mockResolvedValue({
      status: 'not_ready',
      checks: { mongo: 'up', redis: 'down', minio: 'up' }
    })

    const response = await request(app).get('/api/v1/health/ready')

    expect(response.status).toBe(503)
    expect(response.body).toEqual({
      success: false,
      data: {
        status: 'not_ready',
        checks: { mongo: 'up', redis: 'down', minio: 'up' },
        release: { sha: null, environment: null }
      }
    })
  })
})
