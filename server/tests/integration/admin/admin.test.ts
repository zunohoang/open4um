import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '@/app'
import { setupTestDb } from '../testDb'
import { UserModel } from '@/models/user.model'
import { LectureModel } from '@/models/lecture.model'
import { FolderModel } from '@/models/folder.model'
import { CreditConfigModel } from '@/models/creditConfig.model'
import { AiUsageLogModel } from '@/models/aiUsageLog.model'

describe('Integration Tests — Admin Console', () => {
  setupTestDb()

  const createAdmin = async () => {
    const admin = await UserModel.create({
      name: 'Admin User',
      email: `admin-${crypto.randomUUID()}@example.com`,
      passwordHash: 'hashed_password',
      role: 'admin',
      creditBalance: 1000
    })
    const token = jwt.sign(
      { id: admin._id.toString(), role: 'admin', type: 'access' },
      process.env.JWT_SECRET!
    )
    return { admin, adminId: admin._id.toString(), token }
  }

  const createUser = async () => {
    const user = await UserModel.create({
      name: 'Normal User',
      email: `user-${crypto.randomUUID()}@example.com`,
      passwordHash: 'hashed_password',
      role: 'user',
      creditBalance: 50
    })
    const token = jwt.sign(
      { id: user._id.toString(), role: 'user', type: 'access' },
      process.env.JWT_SECRET!
    )
    return { user, userId: user._id.toString(), token }
  }

  describe('User Management', () => {
    describe('GET /api/v1/admin/users', () => {
      it('trả về danh sách user phân trang chính xác từ Database trong Container', async () => {
        const { token: adminToken } = await createAdmin()

        await UserModel.create([
          {
            name: 'User 1',
            email: 'user1@example.com',
            passwordHash: 'hashed_password',
            role: 'user'
          },
          {
            name: 'User 2',
            email: 'user2@example.com',
            passwordHash: 'hashed_password',
            role: 'user'
          },
          {
            name: 'User 3',
            email: 'user3@example.com',
            passwordHash: 'hashed_password',
            role: 'user'
          }
        ])

        const page1Res = await request(app)
          .get('/api/v1/admin/users?page=1&limit=2')
          .set('Authorization', `Bearer ${adminToken}`)

        expect(page1Res.status).toBe(200)
        expect(page1Res.body.success).toBe(true)
        expect(page1Res.body.data.items).toHaveLength(2)
        expect(page1Res.body.data.total).toBe(3)
        expect(page1Res.body.data.page).toBe(1)
        expect(page1Res.body.data.limit).toBe(2)

        const page2Res = await request(app)
          .get('/api/v1/admin/users?page=2&limit=2')
          .set('Authorization', `Bearer ${adminToken}`)

        expect(page2Res.status).toBe(200)
        expect(page2Res.body.success).toBe(true)
        expect(page2Res.body.data.items).toHaveLength(1)
        expect(page2Res.body.data.total).toBe(3)
        expect(page2Res.body.data.page).toBe(2)

        const page1Ids = page1Res.body.data.items.map(
          (u: { _id: string }) => u._id
        )
        const page2Ids = page2Res.body.data.items.map(
          (u: { _id: string }) => u._id
        )
        expect(page1Ids).not.toContain(page2Ids[0])
      })

      it('trả về mảng rỗng nếu không có user nào', async () => {
        const { token: adminToken } = await createAdmin()

        const res = await request(app)
          .get('/api/v1/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)

        expect(res.status).toBe(200)
        expect(res.body.data.items).toHaveLength(0)
      })

      it('trả 401 khi không có token xác thực', async () => {
        const res = await request(app).get('/api/v1/admin/users')
        expect(res.status).toBe(401)
      })

      it('trả 403 khi đăng nhập bằng tài khoản user bình thường', async () => {
        const { token: normalUserToken } = await createUser()
        const res = await request(app)
          .get('/api/v1/admin/users')
          .set('Authorization', `Bearer ${normalUserToken}`)

        expect(res.status).toBe(403)
        expect(res.body.success).toBe(false)
      })
    })

    describe('PATCH /api/v1/admin/users/:id/lock', () => {
      it('khóa tài khoản người dùng thành công và cập nhật trực tiếp trong DB', async () => {
        const { token: adminToken } = await createAdmin()
        const { userId: targetUserId } = await createUser()

        const res = await request(app)
          .patch(`/api/v1/admin/users/${targetUserId}/lock`)
          .set('Authorization', `Bearer ${adminToken}`)

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)

        const userInDb = await UserModel.findById(targetUserId)
        expect(userInDb).not.toBeNull()
        expect(userInDb?.status).toBe('locked')
        expect(userInDb?.lockedAt).toBeInstanceOf(Date)
        expect(userInDb?.scheduledDeleteAt).toBeInstanceOf(Date)
      })

      it('trả 403 khi admin cố gắng khóa tài khoản quản trị viên', async () => {
        const { token: adminToken, adminId } = await createAdmin()
        const res = await request(app)
          .patch(`/api/v1/admin/users/${adminId}/lock`)
          .set('Authorization', `Bearer ${adminToken}`)

        expect(res.status).toBe(403)
        expect(res.body.success).toBe(false)

        const adminInDb = await UserModel.findById(adminId)
        expect(adminInDb?.status).toBe('active')
      })
    })

    describe('DELETE /api/v1/admin/users/:id', () => {
      it('trả 401 khi không đăng nhập', async () => {
        const { userId: targetUserId } = await createUser()
        const res = await request(app).delete(
          `/api/v1/admin/users/${targetUserId}`
        )
        expect(res.status).toBe(401)
      })

      it('trả 403 khi user thường cố xóa người dùng', async () => {
        const { token: normalUserToken } = await createUser()
        const { userId: targetUserId } = await createUser()

        const res = await request(app)
          .delete(`/api/v1/admin/users/${targetUserId}`)
          .set('Authorization', `Bearer ${normalUserToken}`)

        expect(res.status).toBe(403)
      })

      it('trả 403 khi admin cố gắng xóa tài khoản quản trị viên', async () => {
        const { token: adminToken, adminId } = await createAdmin()
        const res = await request(app)
          .delete(`/api/v1/admin/users/${adminId}`)
          .set('Authorization', `Bearer ${adminToken}`)

        expect(res.status).toBe(403)
        expect(res.body.success).toBe(false)

        const adminInDb = await UserModel.findById(adminId)
        expect(adminInDb).not.toBeNull()
      })

      it('xóa vĩnh viễn người dùng và cascade xóa toàn bộ bài giảng, thư mục, ai log trong DB', async () => {
        const { token: adminToken } = await createAdmin()
        const { userId: targetUserId } = await createUser()

        await LectureModel.create({
          userId: targetUserId,
          title: 'Target User Lecture',
          slides: []
        })
        await FolderModel.create({
          userId: targetUserId,
          name: 'Target User Folder'
        })
        await AiUsageLogModel.create({
          userId: targetUserId,
          prompt: 'Tạo slide',
          slideCount: 3,
          creditSpent: 6
        })

        const res = await request(app)
          .delete(`/api/v1/admin/users/${targetUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)

        const userInDb = await UserModel.findById(targetUserId)
        expect(userInDb).toBeNull()

        const remainingLectures = await LectureModel.find({
          userId: targetUserId
        })
        expect(remainingLectures).toHaveLength(0)

        const remainingFolders = await FolderModel.find({
          userId: targetUserId
        })
        expect(remainingFolders).toHaveLength(0)

        const remainingLogs = await AiUsageLogModel.find({
          userId: targetUserId
        })
        expect(remainingLogs).toHaveLength(0)
      })
    })
  })

  describe('Credit & System Configurations', () => {
    describe('GET /api/v1/admin/credit-config', () => {
      it('trả 200 và cấu hình giá credit chính xác từ Database', async () => {
        const { token: adminToken } = await createAdmin()
        await CreditConfigModel.create({
          pricePerSlide: 2,
          pricePerAiEdit: 1,
          signupBonus: 20
        })

        const res = await request(app)
          .get('/api/v1/admin/credit-config')
          .set('Authorization', `Bearer ${adminToken}`)

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.pricePerSlide).toBe(2)
        expect(res.body.data.pricePerAiEdit).toBe(1)
        expect(res.body.data.signupBonus).toBe(20)
      })
    })

    describe('PATCH /api/v1/admin/credit-config', () => {
      it('cập nhật bảng giá credit thành công và lưu thay đổi vào DB', async () => {
        const { token: adminToken } = await createAdmin()
        await CreditConfigModel.create({
          pricePerSlide: 2,
          pricePerAiEdit: 1,
          signupBonus: 20
        })

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

        const configInDb = await CreditConfigModel.findOne()
        expect(configInDb?.pricePerSlide).toBe(10)
        expect(configInDb?.pricePerAiEdit).toBe(3)
        expect(configInDb?.signupBonus).toBe(50)
      })

      it('trả 422 khi truyền giá trị credit âm và không thay đổi DB', async () => {
        const { token: adminToken } = await createAdmin()
        await CreditConfigModel.create({
          pricePerSlide: 2,
          pricePerAiEdit: 1,
          signupBonus: 20
        })

        const res = await request(app)
          .patch('/api/v1/admin/credit-config')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            pricePerSlide: -5
          })

        expect(res.status).toBe(422)
        expect(res.body.success).toBe(false)

        const configInDb = await CreditConfigModel.findOne()
        expect(configInDb?.pricePerSlide).toBe(2)
      })
    })
  })

  describe('AI Usage Logs', () => {
    describe('GET /api/v1/admin/ai-usage', () => {
      it('trả 200 và danh sách nhật ký AI với thông tin người dùng được populate từ DB', async () => {
        const { token: adminToken } = await createAdmin()
        const user = await UserModel.create({
          name: 'Tran Van B',
          email: 'b@example.com',
          passwordHash: 'hashed_password',
          role: 'user'
        })

        await AiUsageLogModel.create({
          userId: user._id.toString(),
          prompt: 'Tạo slide',
          slideCount: 3,
          creditSpent: 6
        })

        const res = await request(app)
          .get('/api/v1/admin/ai-usage?page=1&limit=10')
          .set('Authorization', `Bearer ${adminToken}`)

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.items).toHaveLength(1)
        expect(res.body.data.items[0].prompt).toBe('Tạo slide')
        expect(res.body.data.items[0].creditSpent).toBe(6)
        expect(res.body.data.items[0].userId.name).toBe('Tran Van B')
        expect(res.body.data.items[0].userId.email).toBe('b@example.com')
      })
    })
  })
})
