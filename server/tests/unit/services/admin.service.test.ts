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
  listAiUsage
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

      const result = await listAiUsage(1, 10, 'u-1', '2026-01-01', '2026-01-02')
      expect(result.items).toEqual(mockLogs)
      expect(result.total).toBe(1)
    })
  })
})
