import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '@/app'
import * as adminService from '@/services/admin.service'

jest.mock('@/services/admin.service')

describe('Integration Tests — Payments & Credit Config (/api/v1/admin)', () => {
  const mockedAdminService = jest.mocked(adminService)

  const adminToken = jwt.sign(
    { id: 'admin-1', role: 'admin', type: 'access' },
    process.env.JWT_SECRET!
  )

  const normalUserToken = jwt.sign(
    { id: 'user-1', role: 'user', type: 'access' },
    process.env.JWT_SECRET!
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/v1/admin/credit-config', () => {
    it('trả 401 khi không đăng nhập', async () => {
      const res = await request(app).get('/api/v1/admin/credit-config')
      expect(res.status).toBe(401)
    })

    it('trả 403 khi người dùng không có role admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/credit-config')
        .set('Authorization', `Bearer ${normalUserToken}`)

      expect(res.status).toBe(403)
    })

    it('trả 200 và cấu hình giá credit khi admin truy cập', async () => {
      const mockConfig = {
        pricePerSlide: 2,
        pricePerAiEdit: 1,
        signupBonus: 20
      }
      mockedAdminService.getCreditConfig.mockResolvedValue(mockConfig as any)

      const res = await request(app)
        .get('/api/v1/admin/credit-config')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.pricePerSlide).toBe(2)
      expect(res.body.data.signupBonus).toBe(20)
    })
  })

  describe('PATCH /api/v1/admin/credit-config', () => {
    it('trả 200 và cập nhật bảng giá credit thành công', async () => {
      const updatedConfig = {
        pricePerSlide: 10,
        pricePerAiEdit: 3,
        signupBonus: 50
      }
      mockedAdminService.updateCreditConfig.mockResolvedValue(
        updatedConfig as any
      )

      const res = await request(app)
        .patch('/api/v1/admin/credit-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pricePerSlide: 10,
          pricePerAiEdit: 3,
          signupBonus: 50
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.pricePerSlide).toBe(10)
      expect(mockedAdminService.updateCreditConfig).toHaveBeenCalledWith({
        pricePerSlide: 10,
        pricePerAiEdit: 3,
        signupBonus: 50
      })
    })

    it('trả 422 khi truyền giá trị credit âm không hợp lệ', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/credit-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pricePerSlide: -5
        })

      expect(res.status).toBe(422)
      expect(res.body.success).toBe(false)
    })
  })

  describe('GET /api/v1/admin/ai-usage', () => {
    it('trả 200 và danh sách log giao dịch chi tiêu credit của người dùng', async () => {
      const mockUsageLogs = [
        {
          _id: 'log-1',
          userId: 'user-1',
          prompt: 'Tạo bài giảng AI',
          slideCount: 5,
          creditSpent: 10,
          createdAt: new Date()
        }
      ]
      mockedAdminService.listAiUsage.mockResolvedValue({
        items: mockUsageLogs as any,
        total: 1
      })

      const res = await request(app)
        .get('/api/v1/admin/ai-usage?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.items).toHaveLength(1)
      expect(res.body.data.items[0].creditSpent).toBe(10)
    })
  })
})
