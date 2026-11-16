import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Express } from 'express'
import {
  GenericContainer,
  Wait,
  type StartedTestContainer
} from 'testcontainers'

// SRS UC011 bước 5: ảnh được tải lên server (MinIO thật) và đọc lại qua URL công khai
describe('Integration Tests — Upload ảnh slide (/api/v1/lectures/images, /api/v1/media)', () => {
  let minio: StartedTestContainer
  let app: Express
  const userId = 'b'.repeat(24)
  const token = jwt.sign(
    { id: userId, role: 'user', type: 'access' },
    process.env.JWT_SECRET!
  )
  const PNG_1PX =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4Y6MBAAM4AUGx7UnvAAAAAElFTkSuQmCC'

  beforeAll(async () => {
    // quay.io/minio/minio không còn pull công khai; dùng cùng image với docker-compose.dev.yml
    minio = await new GenericContainer('cgr.dev/chainguard/minio:latest')
      .withUser('0:0')
      .withCommand(['server', '/data'])
      .withEnvironment({
        MINIO_ROOT_USER: 'minioadmin',
        MINIO_ROOT_PASSWORD: 'minioadmin'
      })
      .withExposedPorts(9000)
      .withWaitStrategy(Wait.forHttp('/minio/health/live', 9000))
      .start()

    process.env.MINIO_ENDPOINT = `${minio.getHost()}:${minio.getMappedPort(9000)}`
    jest.resetModules()
    // Nạp lại module sau khi đổi env để minioClient trỏ vào container
    app = (jest.requireActual('@/app') as { app: Express }).app
    await (
      jest.requireActual('@/lib/minio') as {
        connectMinio: () => Promise<void>
      }
    ).connectMinio()
    // Route ảnh không dùng Redis; ngắt client được nạp lại để jest thoát được
    ;(
      jest.requireActual('@/lib/redis') as { redis: { disconnect: () => void } }
    ).redis.disconnect()
  }, 180000)

  afterAll(async () => {
    await minio?.stop()
  })

  it('tải ảnh PNG lên rồi đọc lại đúng nội dung và Content-Type', async () => {
    const upload = await request(app)
      .post('/api/v1/lectures/images')
      .set('Authorization', `Bearer ${token}`)
      .send({ dataUrl: `data:image/png;base64,${PNG_1PX}` })

    expect(upload.status).toBe(201)
    const key: string = upload.body.data.key
    expect(key).toMatch(new RegExp(`^images/${userId}/`))

    const image = await request(app).get(`/api/v1/media/${key}`)
    expect(image.status).toBe(200)
    expect(image.headers['content-type']).toBe('image/png')
    expect(Buffer.from(image.body).equals(Buffer.from(PNG_1PX, 'base64'))).toBe(
      true
    )
  })

  it('trả 401 khi chưa đăng nhập', async () => {
    const res = await request(app)
      .post('/api/v1/lectures/images')
      .send({ dataUrl: `data:image/png;base64,${PNG_1PX}` })
    expect(res.status).toBe(401)
  })

  it('4a - trả 422 với ảnh SVG', async () => {
    const res = await request(app)
      .post('/api/v1/lectures/images')
      .set('Authorization', `Bearer ${token}`)
      .send({ dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' })
    expect(res.status).toBe(422)
  })

  it('trả 404 khi ảnh không tồn tại', async () => {
    const res = await request(app).get(
      `/api/v1/media/images/${userId}/00000000-0000-0000-0000-000000000000.png`
    )
    expect(res.status).toBe(404)
  })
})
