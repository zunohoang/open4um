// Mock dependencies
const mockUserFindById = jest.fn()
const mockUserFindOne = jest.fn()
const mockFolderFindOne = jest.fn()
const mockLectureCreate = jest.fn()
const mockLectureFindOne = jest.fn()
const mockLectureFind = jest.fn()
const mockAiUsageLogCreate = jest.fn()
const mockAiGenerateOutlineFromPrompt = jest.fn()

jest.mock('@/models/user.model', () => ({
  UserModel: {
    findById: (...args: any[]) => mockUserFindById(...args),
    findOne: (...args: any[]) => mockUserFindOne(...args)
  }
}))

jest.mock('@/models/folder.model', () => ({
  FolderModel: {
    findOne: (...args: any[]) => mockFolderFindOne(...args)
  }
}))

jest.mock('@/models/lecture.model', () => ({
  LectureModel: {
    create: (...args: any[]) => mockLectureCreate(...args),
    findOne: (...args: any[]) => mockLectureFindOne(...args),
    find: (...args: any[]) => mockLectureFind(...args)
  }
}))

jest.mock('@/models/aiUsageLog.model', () => ({
  AiUsageLogModel: {
    create: (...args: any[]) => mockAiUsageLogCreate(...args)
  }
}))

jest.mock('@/services/ai.service', () => ({
  generateOutlineFromPrompt: (...args: any[]) =>
    mockAiGenerateOutlineFromPrompt(...args)
}))

jest.mock('@/services/admin.service', () => ({
  getCreditConfig: jest.fn().mockResolvedValue({
    pricePerSlide: 2,
    pricePerAiEdit: 1,
    signupBonus: 20
  })
}))

import {
  generateOutline,
  createBlankLecture,
  getLecture
} from '@/services/lecture.service'

describe('lecture.service unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateOutline', () => {
    it('ném lỗi 422 khi AI trả về outline không có section nào', async () => {
      mockAiGenerateOutlineFromPrompt.mockResolvedValue({
        title: 'Empty',
        sections: []
      })

      await expect(
        generateOutline('user-1', 'Prompt không hợp lệ')
      ).rejects.toMatchObject({
        statusCode: 422
      })
    })

    it('ném lỗi 404 khi không tìm thấy tài khoản người dùng', async () => {
      mockAiGenerateOutlineFromPrompt.mockResolvedValue({
        title: 'Outline',
        sections: [{ title: 'Phần 1', bullets: [] }]
      })
      mockUserFindById.mockResolvedValue(null)

      await expect(
        generateOutline('non-existent-user', 'Học lập trình Go')
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Tài khoản không tồn tại'
      })
    })

    it('ném lỗi 402 khi người dùng không đủ số dư credit', async () => {
      mockAiGenerateOutlineFromPrompt.mockResolvedValue({
        title: 'Outline',
        sections: [
          { title: 'Phần 1', bullets: [] },
          { title: 'Phần 2', bullets: [] }
        ]
      })
      mockUserFindById.mockResolvedValue({
        _id: 'user-poor',
        creditBalance: 1, // cần 2 * 2 = 4 credits
        save: jest.fn()
      })

      await expect(
        generateOutline('user-poor', 'Học lập trình Go')
      ).rejects.toMatchObject({
        statusCode: 402,
        message: expect.stringContaining('Không đủ credit')
      })
    })

    it('thành công: trừ credit, ghi log AI và trả về outline', async () => {
      mockAiGenerateOutlineFromPrompt.mockResolvedValue({
        title: 'Học Go',
        sections: [
          { title: 'Phần 1', bullets: ['A', 'B'] },
          { title: 'Phần 2', bullets: ['C', 'D'] }
        ]
      })
      const mockUser = {
        _id: 'user-rich',
        creditBalance: 50,
        save: jest.fn().mockResolvedValue(true)
      }
      mockUserFindById.mockResolvedValue(mockUser)
      mockAiUsageLogCreate.mockResolvedValue({})

      const result = await generateOutline('user-rich', 'Học lập trình Go')

      expect(mockUser.creditBalance).toBe(46) // 50 - (2 sections * 2)
      expect(mockUser.save).toHaveBeenCalled()
      expect(mockAiUsageLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-rich',
          slideCount: 2,
          creditSpent: 4
        })
      )
      expect(result).toHaveProperty('outline')
      expect(result).toHaveProperty('creditSpent', 4)
      expect(result).toHaveProperty('creditBalance', 46)
    })
  })

  describe('createBlankLecture', () => {
    it('ném lỗi 404 khi chỉ định folderId nhưng thư mục không tồn tại', async () => {
      mockFolderFindOne.mockResolvedValue(null)

      await expect(
        createBlankLecture('user-1', 'Bài giảng mới', 'invalid-folder-id')
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Không tìm thấy thư mục'
      })
    })

    it('tạo bài giảng trắng thành công với slide mặc định khi không truyền folderId', async () => {
      const fakeCreatedLecture = {
        _id: 'lecture-123',
        userId: 'user-1',
        title: 'Bài giảng mới',
        slides: [
          {
            id: 'slide-1',
            pattern: 'default',
            title: '',
            bullets: []
          }
        ]
      }
      mockLectureCreate.mockResolvedValue(fakeCreatedLecture)

      const result = await createBlankLecture('user-1', 'Bài giảng mới')

      expect(mockLectureCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          title: 'Bài giảng mới',
          folderId: null,
          slides: expect.any(Array)
        })
      )
      expect(result).toEqual(fakeCreatedLecture)
    })
  })

  describe('getLecture', () => {
    it('ném lỗi 404 khi bài giảng không tồn tại hoặc không thuộc sở hữu', async () => {
      mockLectureFindOne.mockResolvedValue(null)

      await expect(getLecture('user-1', 'lecture-999')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Không tìm thấy bài giảng'
      })
    })

    it('ném lỗi 404 khi bài giảng đã bị đưa vào thùng rác (deletedAt)', async () => {
      mockLectureFindOne.mockResolvedValue({
        _id: 'lecture-123',
        userId: 'user-1',
        deletedAt: new Date()
      })

      await expect(getLecture('user-1', 'lecture-123')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Bài giảng đã bị xóa'
      })
    })

    it('trả về bài giảng khi hợp lệ', async () => {
      const mockLecture = {
        _id: 'lecture-123',
        userId: 'user-1',
        title: 'Bài giảng của tôi',
        deletedAt: null
      }
      mockLectureFindOne.mockResolvedValue(mockLecture)

      const result = await getLecture('user-1', 'lecture-123')
      expect(result).toEqual(mockLecture)
    })
  })
})
