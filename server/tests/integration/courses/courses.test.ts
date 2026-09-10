import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '@/app'
import * as lectureService from '@/services/lecture.service'

jest.mock('@/services/lecture.service')

describe('Integration Tests — Courses / Lectures (/api/v1/lectures)', () => {
  const mockedLectureService = jest.mocked(lectureService)

  const userToken = jwt.sign(
    { id: 'user-123', role: 'user', type: 'access' },
    process.env.JWT_SECRET!
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

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

  describe('Course / Lecture Operations', () => {
    it('POST /api/v1/lectures/blank tạo bài giảng/khóa học trống thành công trả 201', async () => {
      const mockCreated = {
        _id: 'lec-1',
        title: 'Khóa học Node.js cơ bản',
        userId: 'user-123',
        slides: []
      }
      mockedLectureService.createBlankLecture.mockResolvedValue(
        mockCreated as any
      )

      const res = await request(app)
        .post('/api/v1/lectures/blank')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Khóa học Node.js cơ bản' })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.title).toBe('Khóa học Node.js cơ bản')
      expect(mockedLectureService.createBlankLecture).toHaveBeenCalledWith(
        'user-123',
        'Khóa học Node.js cơ bản',
        undefined
      )
    })

    it('GET /api/v1/lectures trả danh sách bài giảng/khóa học của người dùng', async () => {
      const mockLectures = [
        { _id: 'lec-1', title: 'Khóa học 1', userId: 'user-123' },
        { _id: 'lec-2', title: 'Khóa học 2', userId: 'user-123' }
      ]
      mockedLectureService.listLectures.mockResolvedValue({
        items: mockLectures as any,
        total: 2
      })

      const res = await request(app)
        .get('/api/v1/lectures')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.items).toHaveLength(2)
    })

    it('GET /api/v1/lectures/:id trả chi tiết bài giảng/khóa học', async () => {
      const mockDetail = {
        _id: 'lec-1',
        title: 'Khóa học 1',
        userId: 'user-123',
        slides: [{ id: 's1', elements: [] }]
      }
      mockedLectureService.getLecture.mockResolvedValue(mockDetail as any)

      const res = await request(app)
        .get('/api/v1/lectures/lec-1')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data._id).toBe('lec-1')
      expect(mockedLectureService.getLecture).toHaveBeenCalledWith(
        'user-123',
        'lec-1'
      )
    })

    it('DELETE /api/v1/lectures/:id chuyển bài giảng/khóa học vào thùng rác', async () => {
      mockedLectureService.deleteLecture.mockResolvedValue({
        message: 'Đã chuyển vào thùng rác',
        deletedAt: new Date()
      } as any)

      const res = await request(app)
        .delete('/api/v1/lectures/lec-1')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(mockedLectureService.deleteLecture).toHaveBeenCalledWith(
        'user-123',
        'lec-1'
      )
    })
  })
})
