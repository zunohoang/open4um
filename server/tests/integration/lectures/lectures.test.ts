import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '@/app'
import { setupTestDb } from '../testDb'
import { UserModel } from '@/models/user.model'
import { LectureModel } from '@/models/lecture.model'

describe('Integration Tests — Lectures (/api/v1/lectures)', () => {
  setupTestDb()

  const createTestUser = async () => {
    const user = await UserModel.create({
      name: 'Lecture User',
      email: `user-${crypto.randomUUID()}@example.com`,
      passwordHash: 'hashed_password',
      role: 'user',
      creditBalance: 100
    })
    const userId = user._id.toString()
    const userToken = jwt.sign(
      { id: userId, role: user.role, type: 'access' },
      process.env.JWT_SECRET!
    )
    return { user, userId, userToken }
  }

  describe('Auth Guard', () => {
    it('GET /api/v1/lectures trả 401 khi chưa đăng nhập', async () => {
      const res = await request(app).get('/api/v1/lectures')
      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
    })

    it('POST /api/v1/lectures/blank trả 401 khi chưa đăng nhập', async () => {
      const res = await request(app).post('/api/v1/lectures/blank').send({})
      expect(res.status).toBe(401)
    })
  })

  describe('Lecture Operations', () => {
    it('POST /api/v1/lectures/blank tạo bài giảng trống thành công và lưu vào DB', async () => {
      const { userToken, userId } = await createTestUser()

      const res = await request(app)
        .post('/api/v1/lectures/blank')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Bài giảng Node.js cơ bản' })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.title).toBe('Bài giảng Node.js cơ bản')

      const lectureInDb = await LectureModel.findById(res.body.data._id)
      expect(lectureInDb).not.toBeNull()
      expect(lectureInDb?.title).toBe('Bài giảng Node.js cơ bản')
      expect(lectureInDb?.userId.toString()).toBe(userId)
      expect(lectureInDb?.slides).toHaveLength(1)
    })

    it('GET /api/v1/lectures trả danh sách bài giảng thực tế của người dùng từ DB', async () => {
      const { userToken, userId } = await createTestUser()

      await LectureModel.create([
        {
          userId,
          title: 'Bài giảng 1',
          slides: [{ id: 's1', pattern: 'default' }]
        },
        {
          userId,
          title: 'Bài giảng 2',
          slides: [{ id: 's2', pattern: 'default' }]
        }
      ])

      const res = await request(app)
        .get('/api/v1/lectures?page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.items).toHaveLength(2)
      expect(res.body.data.total).toBe(2)
    })

    it('GET /api/v1/lectures/:id trả chi tiết bài giảng từ DB', async () => {
      const { userToken, userId } = await createTestUser()

      const lecture = await LectureModel.create({
        userId,
        title: 'Bài giảng Chi Tiết',
        slides: [{ id: 's1', pattern: 'default' }]
      })

      const res = await request(app)
        .get(`/api/v1/lectures/${lecture._id}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data._id).toBe(lecture._id.toString())
      expect(res.body.data.title).toBe('Bài giảng Chi Tiết')
    })

    it('DELETE /api/v1/lectures/:id chuyển bài giảng vào thùng rác và cập nhật deletedAt trong DB', async () => {
      const { userToken, userId } = await createTestUser()

      const lecture = await LectureModel.create({
        userId,
        title: 'Bài giảng Cần Xóa',
        slides: [{ id: 's1', pattern: 'default' }]
      })

      const res = await request(app)
        .delete(`/api/v1/lectures/${lecture._id}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const lectureInDb = await LectureModel.findById(lecture._id)
      expect(lectureInDb).not.toBeNull()
      expect(lectureInDb?.deletedAt).toBeInstanceOf(Date)

      const listRes = await request(app)
        .get('/api/v1/lectures')
        .set('Authorization', `Bearer ${userToken}`)

      expect(listRes.status).toBe(200)
      expect(listRes.body.success).toBe(true)
      const itemIds = listRes.body.data.items.map(
        (item: { _id: string }) => item._id
      )
      expect(itemIds).not.toContain(lecture._id.toString())
    })
  })

  describe('Data Isolation & IDOR Protection', () => {
    it('User A không thể xem chi tiết bài giảng của User B (GET /api/v1/lectures/:id)', async () => {
      const { userToken: userAToken } = await createTestUser()
      const { userId: userBId } = await createTestUser()

      const lectureB = await LectureModel.create({
        userId: userBId,
        title: 'Bài giảng riêng tư của User B',
        slides: [{ id: 's-b-1', pattern: 'default' }]
      })

      const res = await request(app)
        .get(`/api/v1/lectures/${lectureB._id}`)
        .set('Authorization', `Bearer ${userAToken}`)

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
    })

    it('User A không thể sửa bài giảng của User B (PATCH /api/v1/lectures/:id)', async () => {
      const { userToken: userAToken } = await createTestUser()
      const { userId: userBId } = await createTestUser()

      const lectureB = await LectureModel.create({
        userId: userBId,
        title: 'Bài giảng riêng tư của User B',
        slides: [{ id: 's-b-1', pattern: 'default' }]
      })

      const res = await request(app)
        .patch(`/api/v1/lectures/${lectureB._id}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ title: 'Hacked title' })

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)

      const lectureInDb = await LectureModel.findById(lectureB._id)
      expect(lectureInDb?.title).toBe('Bài giảng riêng tư của User B')
    })

    it('User A không thể xóa bài giảng của User B (DELETE /api/v1/lectures/:id) và DB không bị biến đổi', async () => {
      const { userToken: userAToken } = await createTestUser()
      const { userId: userBId } = await createTestUser()

      const lectureB = await LectureModel.create({
        userId: userBId,
        title: 'Bài giảng riêng tư của User B',
        slides: [{ id: 's-b-1', pattern: 'default' }]
      })

      const res = await request(app)
        .delete(`/api/v1/lectures/${lectureB._id}`)
        .set('Authorization', `Bearer ${userAToken}`)

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)

      const lectureInDb = await LectureModel.findById(lectureB._id)
      expect(lectureInDb).not.toBeNull()
      expect(lectureInDb?.deletedAt).toBeNull()
    })
  })
})
