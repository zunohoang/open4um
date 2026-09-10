import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '@/app'
import * as adminService from '@/services/admin.service'

jest.mock('@/services/admin.service')

describe('Integration Tests — Users Management (/api/v1/admin/users)', () => {
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

  describe('GET /api/v1/admin/users', () => {
    it('trả 401 khi không đăng nhập', async () => {
      const res = await request(app).get('/api/v1/admin/users')
      expect(res.status).toBe(401)
    })

    it('trả 403 khi đăng nhập bằng tài khoản user bình thường (không phải admin)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${normalUserToken}`)

      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
    })

    it('trả 200 và danh sách người dùng phân trang khi đăng nhập bằng admin', async () => {
      const mockUsers = [
        {
          _id: 'u1',
          name: 'Nguyen Van A',
          email: 'a@example.com',
          role: 'user',
          creditBalance: 20
        },
        {
          _id: 'u2',
          name: 'Tran Van B',
          email: 'b@example.com',
          role: 'user',
          creditBalance: 50
        }
      ]
      mockedAdminService.listUsers.mockResolvedValue({
        items: mockUsers as any,
        total: 2
      })

      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.items).toHaveLength(2)
      expect(res.body.data.total).toBe(2)
    })
  })

  describe('PATCH /api/v1/admin/users/:id/lock', () => {
    it('trả 200 và trạng thái locked khi admin khóa người dùng', async () => {
      mockedAdminService.lockUser.mockResolvedValue({
        _id: 'u1',
        status: 'locked'
      } as any)

      const res = await request(app)
        .patch('/api/v1/admin/users/u1/lock')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(mockedAdminService.lockUser).toHaveBeenCalledWith('u1', 'admin-1')
    })
  })
})
