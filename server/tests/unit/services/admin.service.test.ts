import bcrypt from 'bcrypt'
import {
  listUsers,
  createUser,
  updateUser,
  lockUser,
  restoreUser,
  deleteUser,
  cleanupExpiredLockedUsers,
  getCreditConfig,
  updateCreditConfig,
  listAiUsage,
  getDashboardStats
} from '@/services/admin.service'
import { UserModel } from '@/models/user.model'
import { LectureModel } from '@/models/lecture.model'
import { FolderModel } from '@/models/folder.model'
import { AiUsageLogModel } from '@/models/aiUsageLog.model'
import { CreditConfigModel } from '@/models/creditConfig.model'

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password')
}))

jest.mock('@/models/user.model')
jest.mock('@/models/lecture.model')
jest.mock('@/models/folder.model')
jest.mock('@/models/aiUsageLog.model')
jest.mock('@/models/creditConfig.model')

describe('admin.service unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('listUsers', () => {
    it('lấy danh sách người dùng phân trang thành công', async () => {
      const mockUsers = [
        { _id: 'u1', name: 'User 1', email: 'u1@example.com' },
        { _id: 'u2', name: 'User 2', email: 'u2@example.com' }
      ]
      const mockFind = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockUsers)
      }
      ;(UserModel.find as jest.Mock).mockReturnValue(mockFind)
      ;(UserModel.countDocuments as jest.Mock).mockResolvedValue(2)

      const result = await listUsers(1, 10, 'User')

      expect(result.items).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(UserModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          role: { $ne: 'admin' },
          $or: expect.any(Array)
        })
      )
    })

    it('escape ký tự đặc biệt để tìm theo chuỗi nguyên văn', async () => {
      const mockFind = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      }
      ;(UserModel.find as jest.Mock).mockReturnValue(mockFind)
      ;(UserModel.countDocuments as jest.Mock).mockResolvedValue(0)

      await listUsers(1, 10, 'a+b(')

      expect(UserModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { name: { $regex: 'a\\+b\\(', $options: 'i' } },
            { email: { $regex: 'a\\+b\\(', $options: 'i' } }
          ]
        })
      )
    })
  })

  describe('createUser', () => {
    it('ném lỗi 409 khi email đã tồn tại', async () => {
      ;(UserModel.findOne as jest.Mock).mockResolvedValue({
        _id: 'u1',
        email: 'exist@example.com'
      })

      await expect(
        createUser({
          name: 'Nguyen Van A',
          email: 'exist@example.com',
          password: 'password123'
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('Email đã được sử dụng')
      })
    })

    it('tạo người dùng thành công và nhận credit khởi tạo', async () => {
      ;(UserModel.findOne as jest.Mock).mockResolvedValue(null)
      ;(CreditConfigModel.findOne as jest.Mock).mockResolvedValue({
        signupBonus: 50
      })
      ;(UserModel.create as jest.Mock).mockResolvedValue({
        _id: 'u-new',
        name: 'Nguyen Van B',
        email: 'b@example.com',
        role: 'user',
        creditBalance: 50,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const user = await createUser({
        name: 'Nguyen Van B',
        email: 'b@example.com',
        password: 'password123'
      })

      expect(user.name).toBe('Nguyen Van B')
      expect(user.creditBalance).toBe(50)
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10)
      expect(UserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'b@example.com',
          passwordHash: 'hashed_password',
          role: 'user',
          creditBalance: 50
        })
      )
    })
  })

  describe('updateUser', () => {
    it('ném lỗi 404 khi không tìm thấy người dùng', async () => {
      ;(UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      })

      await expect(
        updateUser('u-unknown', { creditBalance: 100 })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Không tìm thấy')
      })
    })

    it('ném lỗi 403 khi cố gắng sửa tài khoản quản trị viên', async () => {
      const mockAdmin = {
        _id: 'admin-1',
        role: 'admin'
      }
      ;(UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAdmin)
      })

      await expect(
        updateUser('admin-1', { creditBalance: 100 })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('quản trị viên')
      })
    })

    it('cập nhật số dư credit thành công cho người dùng', async () => {
      const mockUser = {
        _id: 'u-1',
        role: 'user',
        creditBalance: 20,
        save: jest.fn().mockResolvedValue(true)
      }
      ;(UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      })

      const result = await updateUser('u-1', { creditBalance: 80 })

      expect(result.creditBalance).toBe(80)
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('cập nhật họ tên, email (chuẩn hóa chữ thường) và credit thành công', async () => {
      const mockUser = {
        _id: 'u-1',
        role: 'user',
        name: 'Tên cũ',
        email: 'old@example.com',
        creditBalance: 20,
        save: jest.fn().mockResolvedValue(true)
      }
      ;(UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      })
      ;(UserModel.findOne as jest.Mock).mockResolvedValue(null)

      const result = await updateUser('u-1', {
        name: 'Tên mới',
        email: '  New@Example.com ',
        creditBalance: 80
      })

      expect(UserModel.findOne).toHaveBeenCalledWith({
        email: 'new@example.com',
        _id: { $ne: 'u-1' }
      })
      expect(result).toMatchObject({
        name: 'Tên mới',
        email: 'new@example.com',
        creditBalance: 80
      })
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('ném lỗi 409 và không lưu khi email đã thuộc về người dùng khác', async () => {
      const mockUser = {
        _id: 'u-1',
        role: 'user',
        email: 'old@example.com',
        save: jest.fn().mockResolvedValue(true)
      }
      ;(UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      })
      ;(UserModel.findOne as jest.Mock).mockResolvedValue({ _id: 'u-2' })

      await expect(
        updateUser('u-1', { email: 'taken@example.com' })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('Email đã được sử dụng')
      })
      expect(mockUser.email).toBe('old@example.com')
      expect(mockUser.save).not.toHaveBeenCalled()
    })
  })

  describe('lockUser', () => {
    it('ném lỗi 404 khi không tìm thấy người dùng', async () => {
      ;(UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      })

      await expect(lockUser('u-unknown')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Không tìm thấy')
      })
    })

    it('ném lỗi 403 khi cố gắng khóa tài khoản quản trị viên', async () => {
      const mockAdmin = {
        _id: 'admin-1',
        role: 'admin'
      }
      ;(UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAdmin)
      })

      await expect(lockUser('admin-1')).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('quản trị viên')
      })
    })

    it('khóa người dùng thành công và thiết lập thời hạn xóa 30 ngày', async () => {
      const mockUser = {
        _id: 'u-1',
        role: 'user',
        status: 'active',
        lockedAt: null,
        scheduledDeleteAt: null,
        save: jest.fn().mockResolvedValue(true)
      }
      ;(UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      })

      const result = await lockUser('u-1')

      expect(result.status).toBe('locked')
      expect(result.lockedAt).toBeInstanceOf(Date)
      expect(result.scheduledDeleteAt).toBeInstanceOf(Date)
      expect(mockUser.save).toHaveBeenCalled()
    })
  })

  describe('restoreUser', () => {
    it('ném lỗi 404 khi không tìm thấy người dùng', async () => {
      ;(UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      })

      await expect(restoreUser('u-unknown')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Không tìm thấy')
      })
    })

    it('khôi phục người dùng thành công về trạng thái hoạt động', async () => {
      const mockUser = {
        _id: 'u-1',
        status: 'locked',
        lockedAt: new Date(),
        scheduledDeleteAt: new Date(),
        save: jest.fn().mockResolvedValue(true)
      }
      ;(UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      })

      const result = await restoreUser('u-1')

      expect(result.status).toBe('active')
      expect(result.lockedAt).toBeNull()
      expect(result.scheduledDeleteAt).toBeNull()
      expect(mockUser.save).toHaveBeenCalled()
    })
  })

  describe('deleteUser', () => {
    it('ném lỗi 404 khi không tìm thấy người dùng', async () => {
      ;(UserModel.findById as jest.Mock).mockResolvedValue(null)

      await expect(deleteUser('user-999')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Không tìm thấy người dùng')
      })
    })

    it('ném lỗi 403 khi cố gắng xóa tài khoản có role là admin', async () => {
      ;(UserModel.findById as jest.Mock).mockResolvedValue({
        _id: 'admin-1',
        role: 'admin'
      })

      await expect(deleteUser('admin-1')).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining(
          'Không thể xóa tài khoản quản trị viên'
        )
      })
    })

    it('xóa thành công người dùng và cascade xóa bài giảng, thư mục, ai log', async () => {
      ;(UserModel.findById as jest.Mock).mockResolvedValue({
        _id: 'user-1',
        role: 'user'
      })
      ;(UserModel.findByIdAndDelete as jest.Mock).mockResolvedValue({})
      ;(LectureModel.deleteMany as jest.Mock).mockResolvedValue({})
      ;(FolderModel.deleteMany as jest.Mock).mockResolvedValue({})
      ;(AiUsageLogModel.deleteMany as jest.Mock).mockResolvedValue({})

      const result = await deleteUser('user-1')

      expect(result).toEqual({
        id: 'user-1',
        message: 'Đã xóa người dùng thành công'
      })
      expect(UserModel.findByIdAndDelete).toHaveBeenCalledWith('user-1')
      expect(LectureModel.deleteMany).toHaveBeenCalledWith({ userId: 'user-1' })
      expect(FolderModel.deleteMany).toHaveBeenCalledWith({ userId: 'user-1' })
      expect(AiUsageLogModel.deleteMany).toHaveBeenCalledWith({
        userId: 'user-1'
      })
    })
  })

  describe('cleanupExpiredLockedUsers', () => {
    it('trả về 0 khi không có người dùng hết hạn khóa', async () => {
      ;(UserModel.find as jest.Mock).mockResolvedValue([])

      const count = await cleanupExpiredLockedUsers()
      expect(count).toBe(0)
    })

    it('xóa vĩnh viễn các tài khoản đã quá hạn 30 ngày khóa kèm cascade data', async () => {
      const expired = [{ _id: 'u-exp-1' }, { _id: 'u-exp-2' }]
      ;(UserModel.find as jest.Mock).mockResolvedValue(expired)
      ;(UserModel.deleteMany as jest.Mock).mockResolvedValue({})
      ;(LectureModel.deleteMany as jest.Mock).mockResolvedValue({})
      ;(FolderModel.deleteMany as jest.Mock).mockResolvedValue({})

      const count = await cleanupExpiredLockedUsers()

      expect(count).toBe(2)
      expect(UserModel.deleteMany).toHaveBeenCalledWith({
        _id: { $in: ['u-exp-1', 'u-exp-2'] }
      })
    })
  })

  describe('Credit Config & AI Usage', () => {
    it('lấy cấu hình credit hiện tại hoặc tạo mới nếu chưa có', async () => {
      const mockConfig = { pricePerSlide: 2, signupBonus: 20 }
      ;(CreditConfigModel.findOne as jest.Mock).mockResolvedValue(mockConfig)

      const result = await getCreditConfig()
      expect(result).toEqual(mockConfig)
    })

    it('cập nhật bảng giá credit thành công', async () => {
      const mockConfig = {
        pricePerSlide: 2,
        save: jest.fn().mockResolvedValue(true)
      }
      ;(CreditConfigModel.findOne as jest.Mock).mockResolvedValue(mockConfig)

      const result = await updateCreditConfig({ pricePerSlide: 5 })
      expect(result.pricePerSlide).toBe(5)
      expect(mockConfig.save).toHaveBeenCalled()
    })

    it('lấy danh sách nhật ký AI phân trang thành công', async () => {
      const mockLogs = [{ _id: 'log-1', prompt: 'test' }]
      const mockFind = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockLogs)
      }
      ;(AiUsageLogModel.find as jest.Mock).mockReturnValue(mockFind)
      ;(AiUsageLogModel.countDocuments as jest.Mock).mockResolvedValue(1)

      const result = await listAiUsage(
        1,
        10,
        '507f1f77bcf86cd799439011',
        '2026-01-01',
        '2026-01-02'
      )
      expect(result.items).toEqual(mockLogs)
      expect(result.total).toBe(1)
    })

    it('từ chối khoảng ngày không hợp lệ', async () => {
      await expect(
        listAiUsage(1, 10, undefined, '2026-01-03', '2026-01-02')
      ).rejects.toMatchObject({ statusCode: 422 })

      expect(AiUsageLogModel.find).not.toHaveBeenCalled()
    })
  })

  describe('getDashboardStats', () => {
    const mockRecentFind = (rows: unknown[]) => {
      const chain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(rows)
      }
      ;(AiUsageLogModel.find as jest.Mock).mockReturnValue(chain)
      return chain
    }

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('gom theo ngày giờ Việt Nam, điền 0 cho ngày trống và cộng tổng trong khoảng', async () => {
      ;(UserModel.aggregate as jest.Mock).mockResolvedValue([
        { _id: '2026-01-01', count: 2 },
        { _id: '2026-01-03', count: 1 }
      ])
      ;(LectureModel.aggregate as jest.Mock).mockResolvedValue([
        { _id: '2026-01-02', count: 4 }
      ])
      ;(AiUsageLogModel.aggregate as jest.Mock)
        .mockResolvedValueOnce([
          { _id: '2026-01-02', usages: 3, slides: 12, credits: 30 }
        ])
        .mockResolvedValueOnce([
          { _id: null, usages: 10, slides: 50, credits: 200 }
        ])
      ;(UserModel.countDocuments as jest.Mock).mockResolvedValue(20)
      ;(LectureModel.countDocuments as jest.Mock).mockResolvedValue(40)
      const recentFind = mockRecentFind([{ _id: 'log-1' }])

      const result = await getDashboardStats('2026-01-01', '2026-01-03')

      expect(result.series).toEqual([
        { date: '2026-01-01', users: 2, lectures: 0, creditsSpent: 0 },
        { date: '2026-01-02', users: 0, lectures: 4, creditsSpent: 30 },
        { date: '2026-01-03', users: 1, lectures: 0, creditsSpent: 0 }
      ])
      expect(result.totals).toEqual({
        users: 3,
        lectures: 4,
        aiUsages: 3,
        aiSlides: 12,
        creditsSpent: 30
      })
      expect(result.allTime).toEqual({
        users: 20,
        lectures: 40,
        aiUsages: 10,
        aiSlides: 50,
        creditsSpent: 200
      })
      expect(result.recentActivities).toEqual([{ _id: 'log-1' }])

      // 00:00 giờ VN ngày 01/01 đến trước 00:00 giờ VN ngày 04/01
      const createdAt = {
        $gte: new Date('2025-12-31T17:00:00.000Z'),
        $lt: new Date('2026-01-03T17:00:00.000Z')
      }
      expect(UserModel.aggregate).toHaveBeenCalledWith([
        { $match: { role: 'user', createdAt } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: 'Asia/Ho_Chi_Minh'
              }
            },
            count: { $sum: 1 }
          }
        }
      ])
      expect(AiUsageLogModel.find).toHaveBeenCalledWith({ createdAt })
      expect(recentFind.populate).toHaveBeenCalledWith('userId', 'name email')
      expect(recentFind.sort).toHaveBeenCalledWith({ createdAt: -1 })
      expect(recentFind.limit).toHaveBeenCalledWith(10)
    })

    it('mặc định lấy 30 ngày gần nhất tính theo giờ Việt Nam', async () => {
      // 18:00 UTC ngày 31/01 = 01:00 ngày 01/02 giờ Việt Nam
      jest
        .spyOn(Date, 'now')
        .mockReturnValue(new Date('2026-01-31T18:00:00.000Z').getTime())
      ;(UserModel.aggregate as jest.Mock).mockResolvedValue([])
      ;(LectureModel.aggregate as jest.Mock).mockResolvedValue([])
      ;(AiUsageLogModel.aggregate as jest.Mock).mockResolvedValue([])
      ;(UserModel.countDocuments as jest.Mock).mockResolvedValue(0)
      ;(LectureModel.countDocuments as jest.Mock).mockResolvedValue(0)
      mockRecentFind([])

      const result = await getDashboardStats()

      expect(result.from).toBe('2026-01-03')
      expect(result.to).toBe('2026-02-01')
      expect(result.series).toHaveLength(30)
      expect(result.allTime).toEqual({
        users: 0,
        lectures: 0,
        aiUsages: 0,
        aiSlides: 0,
        creditsSpent: 0
      })
    })

    it.each([
      ['từ ngày sau đến ngày', '2026-01-03', '2026-01-02'],
      ['khoảng vượt quá 366 ngày', '2025-01-01', '2026-01-02'],
      ['ngày không tồn tại', '2026-02-30', '2026-03-01'],
      ['sai định dạng', '01/01/2026', '2026-01-02']
    ])('từ chối khoảng ngày %s', async (_caseName, from, to) => {
      await expect(getDashboardStats(from, to)).rejects.toMatchObject({
        statusCode: 422
      })
      expect(UserModel.aggregate).not.toHaveBeenCalled()
    })
  })
})
