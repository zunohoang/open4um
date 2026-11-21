import { EventEmitter } from 'node:events'
import type { Request, Response } from 'express'
import { requestContext } from '@/middlewares/requestContext.middleware'
import { withAiRequest } from '@/utils/aiRequest'
// Mock dependencies
const mockUserFindById = jest.fn()
const mockUserFindOne = jest.fn()
const mockFolderFindOne = jest.fn()
const mockLectureCreate = jest.fn()
const mockLectureFindOne = jest.fn()
const mockLectureExists = jest.fn()
const mockLectureFind = jest.fn()
const mockLectureDeleteOne = jest.fn()
const mockLectureFindOneAndUpdate = jest.fn()
const mockUpdateOne = jest.fn()
const mockUsageDelete = jest.fn()
const mockAuditSet = jest.fn()
jest.mock('@/lib/redis', () => ({
  redis: { set: (...args: unknown[]) => mockAuditSet(...args) }
}))
const mockAiUsageLogCreate = jest.fn()
const mockAiGenerateOutlineFromPrompt = jest.fn()
const mockAiRefineOutlineWithFeedback = jest.fn()
const mockAiGenerateSlidesFromOutline = jest.fn()
const mockAiBuildSlidesFromOutline = jest.fn()
const mockEditSelectedText = jest.fn()
const mockAiChatAndProposeSlideEdit = jest.fn()
const mockDebitCredits = jest.fn(async (_userId: string, amount: number) => {
  const user = await mockUserFindById()
  if (!user || user.creditBalance < amount) throw new Error('Insufficient')
  user.creditBalance -= amount
  return user.creditBalance
})
const mockRefundCredits = jest.fn(async (_userId: string, amount: number) => {
  const user = await mockUserFindById()
  if (user) user.creditBalance += amount
})

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
    exists: (...args: unknown[]) => mockLectureExists(...args),
    find: (...args: any[]) => mockLectureFind(...args),
    updateOne: (...args: unknown[]) => mockUpdateOne(...args),
    deleteOne: (...args: any[]) => mockLectureDeleteOne(...args),
    findOneAndUpdate: (...args: any[]) => mockLectureFindOneAndUpdate(...args)
  }
}))

jest.mock('@/models/aiUsageLog.model', () => ({
  AiUsageLogModel: {
    deleteOne: (...args: unknown[]) => mockUsageDelete(...args),
    create: (...args: any[]) => mockAiUsageLogCreate(...args)
  }
}))

jest.mock('@/services/ai.service', () => ({
  editSelectedText: (...args: unknown[]) => mockEditSelectedText(...args),
  generateOutlineFromPrompt: (...args: any[]) =>
    mockAiGenerateOutlineFromPrompt(...args),
  refineOutlineWithFeedback: (...args: any[]) =>
    mockAiRefineOutlineWithFeedback(...args),
  generateSlidesFromOutline: (...args: any[]) =>
    mockAiGenerateSlidesFromOutline(...args),
  buildSlidesFromOutline: (...args: any[]) =>
    mockAiBuildSlidesFromOutline(...args),
  chatAndProposeSlideEdit: (...args: any[]) =>
    mockAiChatAndProposeSlideEdit(...args)
}))

jest.mock('@/services/admin.service', () => ({
  getCreditConfig: jest.fn().mockResolvedValue({
    pricePerSlide: 2,
    pricePerAiEdit: 1,
    pricePerOutline: 4,
    signupBonus: 20
  })
}))

jest.mock('@/services/credit.service', () => ({
  debitCredits: (...args: Parameters<typeof mockDebitCredits>) =>
    mockDebitCredits(...args),
  refundCredits: (...args: Parameters<typeof mockRefundCredits>) =>
    mockRefundCredits(...args)
}))

import {
  generateOutline,
  createLecture,
  createBlankLecture,
  duplicateLecture,
  getLecture,
  hardDeleteLecture,
  aiChatInEditor
} from '@/services/lecture.service'

const LECTURE_ID = 'a'.repeat(24)
const MISSING_LECTURE_ID = 'f'.repeat(24)

describe('lecture.service unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLectureFindOne.mockReset().mockResolvedValue(null)
    mockLectureExists.mockReset().mockResolvedValue(null)
    mockLectureFindOneAndUpdate.mockReset()
    mockAiUsageLogCreate.mockReset().mockResolvedValue({ _id: 'usage-1' })
  })

  describe('generateOutline', () => {
    it('ném lỗi 404 khi không tìm thấy tài khoản người dùng (pre-check)', async () => {
      mockUserFindById.mockResolvedValue(null)

      await expect(
        generateOutline('non-existent-user', 'Học lập trình Go')
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Tài khoản không tồn tại'
      })
      expect(mockAiGenerateOutlineFromPrompt).not.toHaveBeenCalled()
    })

    it('ném lỗi 402 khi người dùng không đủ credit trước khi gọi AI (pre-check)', async () => {
      mockUserFindById.mockResolvedValue({
        _id: 'user-poor',
        creditBalance: 2, // cần pricePerOutline = 4
        save: jest.fn()
      })

      await expect(
        generateOutline('user-poor', 'Học lập trình Go')
      ).rejects.toMatchObject({
        statusCode: 402,
        message: expect.stringContaining('Không đủ credit để sinh dàn ý')
      })
      expect(mockAiGenerateOutlineFromPrompt).not.toHaveBeenCalled()
    })

    it('ném lỗi 422 khi AI trả về outline không có section nào', async () => {
      mockUserFindById.mockResolvedValue({
        _id: 'user-1',
        creditBalance: 20,
        save: jest.fn()
      })
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

    it('thành công: trừ credit, ghi log AI và trả về outline', async () => {
      mockAiGenerateOutlineFromPrompt.mockResolvedValue({
        title: 'Học Go',
        sections: [
          { heading: 'Phần 1', bullets: ['A', 'B'] },
          { heading: 'Phần 2', bullets: ['C', 'D'] }
        ]
      })
      const mockUser = {
        _id: 'user-rich',
        creditBalance: 50,
        save: jest.fn().mockResolvedValue(true)
      }
      mockUserFindById.mockResolvedValue(mockUser)
      mockAiUsageLogCreate.mockResolvedValue({})
      const mockCreatedDraft = {
        _id: LECTURE_ID,
        userId: 'user-rich',
        title: 'Học Go',
        outline: expect.any(Object),
        slides: []
      }
      mockLectureCreate.mockResolvedValue(mockCreatedDraft)

      const result = await generateOutline('user-rich', 'Học lập trình Go')

      expect(mockUser.creditBalance).toBe(46) // 50 - 4 (pricePerOutline)
      expect(mockDebitCredits).toHaveBeenCalledWith(
        'user-rich',
        4,
        expect.any(String)
      )
      expect(mockLectureCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-rich',
          title: 'Học Go',
          outline: expect.objectContaining({ title: 'Học Go' }),
          slides: []
        })
      )
      expect(mockAiUsageLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-rich',
          slideCount: 0,
          creditSpent: 4
        })
      )
      expect(result).toHaveProperty('lecture')
      expect(result).toHaveProperty('outline')
      expect(result).toHaveProperty('creditSpent', 4)
      expect(result).toHaveProperty('creditBalance', 46)
    })

    it('thành công khi có feedback & currentOutline: gọi refineOutlineWithFeedback và cập nhật lectureId', async () => {
      const currentOutline = {
        title: 'Bản cũ',
        sections: [{ heading: 'Mục 1', bullets: ['A'] }]
      }
      const refinedOutline = {
        title: 'Bản mới điều chỉnh',
        sections: [
          { heading: 'Mục 1', bullets: ['A'] },
          { heading: 'Thực hành', bullets: ['B'] }
        ]
      }
      mockAiRefineOutlineWithFeedback.mockResolvedValue(refinedOutline)

      const mockUser = {
        _id: 'user-refine',
        creditBalance: 30,
        save: jest.fn().mockResolvedValue(true)
      }
      mockUserFindById.mockResolvedValue(mockUser)

      const mockUpdatedLecture = {
        _id: LECTURE_ID,
        title: 'Bản mới điều chỉnh',
        prompt: 'Prompt gốc',
        outline: refinedOutline
      }
      mockLectureFindOneAndUpdate.mockResolvedValue(mockUpdatedLecture)
      mockLectureFindOne.mockResolvedValue({
        ...mockUpdatedLecture,
        userId: 'user-refine',
        deletedAt: null,
        revision: 3
      })

      const result = await generateOutline('user-refine', 'Prompt gốc', {
        feedback: 'Thêm phần thực hành',
        currentOutline,
        lectureId: LECTURE_ID
      })

      expect(mockAiRefineOutlineWithFeedback).toHaveBeenCalledWith(
        currentOutline,
        'Prompt gốc',
        'Thêm phần thực hành',
        undefined
      )
      expect(mockLectureFindOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: LECTURE_ID,
          userId: 'user-refine',
          deletedAt: null,
          revision: 3
        },
        // UC021: không ghi đè tên bài giảng người dùng đã đặt
        {
          $set: { prompt: 'Prompt gốc', outline: refinedOutline },
          $inc: { revision: 1 }
        },
        { new: true }
      )
      expect(mockAiUsageLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Prompt gốc | Góp ý: Thêm phần thực hành'
        })
      )
      expect(result.outline.title).toBe('Bản mới điều chỉnh')
      expect(result.creditSpent).toBe(4)
      expect(result.creditBalance).toBe(26)
    })
  })

  describe('createLecture (sinh slide chi tiết 2 bước)', () => {
    const fakeOutline = {
      title: 'Lập trình TypeScript',
      sections: [
        { heading: 'Giới thiệu', bullets: ['TS là gì', 'Ưu điểm'] },
        { heading: 'Kiểu dữ liệu', bullets: ['Primitive', 'Interface'] }
      ]
    }

    it('ném lỗi 402 trước khi gọi AI nếu không đủ credit cho số slide dự kiến', async () => {
      // 2 phần dàn ý x 2 credit/slide = 4 credit dự kiến
      mockUserFindById.mockResolvedValue({
        _id: 'user-poor',
        creditBalance: 3,
        save: jest.fn()
      })

      await expect(
        createLecture('user-poor', {
          title: 'TypeScript cơ bản',
          prompt: 'Dạy TS',
          outline: fakeOutline
        })
      ).rejects.toMatchObject({
        statusCode: 402,
        message: expect.stringContaining('Không đủ credit để tạo bài giảng')
      })
      expect(mockAiGenerateSlidesFromOutline).not.toHaveBeenCalled()
    })

    it('UC032 - tính phí theo số slide được sinh ra (pricePerSlide x số slide)', async () => {
      const mockSlides = Array.from({ length: 8 }, (_, i) => ({
        id: `s-${i + 1}`,
        title: `Slide ${i + 1}`
      }))
      mockAiGenerateSlidesFromOutline.mockResolvedValue(mockSlides)

      const mockUser = {
        _id: 'user-rich',
        creditBalance: 50,
        save: jest.fn().mockResolvedValue(true)
      }
      mockUserFindById.mockResolvedValue(mockUser)

      const mockCreatedLecture = {
        _id: LECTURE_ID,
        title: 'TypeScript cơ bản',
        slides: mockSlides,
        toObject: () => ({
          _id: LECTURE_ID,
          title: 'TypeScript cơ bản',
          slides: mockSlides
        })
      }
      mockLectureCreate.mockResolvedValue(mockCreatedLecture)

      const result = await createLecture('user-rich', {
        title: 'TypeScript cơ bản',
        prompt: 'Dạy TS',
        outline: fakeOutline
      })

      // 8 slide x 2 credit = 16 -> 50 - 16 = 34
      expect(mockUser.creditBalance).toBe(34)
      expect(mockDebitCredits).toHaveBeenCalledWith(
        'user-rich',
        16,
        expect.any(String)
      )
      expect(mockAiUsageLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-rich',
          slideCount: 8,
          creditSpent: 16
        })
      )
      expect(result).toHaveProperty('creditSpent', 16)
      expect(result).toHaveProperty('creditBalance', 34)
    })

    it('thành công cập nhật bài giảng đã có bằng lectureId', async () => {
      const mockSlides = [{ id: 's1', title: 'Slide 1' }]
      mockAiGenerateSlidesFromOutline.mockResolvedValue(mockSlides)

      const mockUser = {
        _id: 'user-rich',
        creditBalance: 50,
        save: jest.fn().mockResolvedValue(true)
      }
      mockUserFindById.mockResolvedValue(mockUser)

      const mockUpdated = {
        _id: LECTURE_ID,
        title: 'TypeScript cơ bản',
        slides: mockSlides,
        toObject: () => ({
          _id: LECTURE_ID,
          title: 'TypeScript cơ bản',
          slides: mockSlides
        })
      }
      mockLectureFindOneAndUpdate.mockResolvedValue(mockUpdated)
      mockLectureFindOne.mockResolvedValue({
        ...mockUpdated,
        userId: 'user-rich',
        deletedAt: null,
        revision: 2
      })

      const result = await createLecture('user-rich', {
        lectureId: LECTURE_ID,
        title: 'TypeScript cơ bản',
        prompt: 'Dạy TS',
        outline: fakeOutline
      })

      expect(mockLectureFindOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: LECTURE_ID,
          userId: 'user-rich',
          deletedAt: null,
          revision: 2
        },
        {
          $set: expect.objectContaining({
            title: 'TypeScript cơ bản',
            slides: expect.arrayContaining([
              expect.objectContaining({ id: 's1', title: 'Slide 1' })
            ])
          }),
          $inc: { revision: 1 }
        },
        { new: true }
      )
      expect(result._id).toBe(LECTURE_ID)
    })
  })

  describe('createBlankLecture', () => {
    it('ném lỗi 404 khi chỉ định folderId nhưng thư mục không tồn tại', async () => {
      mockFolderFindOne.mockResolvedValue(null)

      await expect(
        createBlankLecture(
          'user-1',
          'Bài giảng mới',
          undefined,
          'invalid-folder-id'
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Không tìm thấy thư mục'
      })
    })

    it('tạo bài giảng trắng thành công với slide mặc định khi không truyền folderId', async () => {
      const fakeCreatedLecture = {
        _id: LECTURE_ID,
        userId: 'user-1',
        title: 'Bài giảng mới',
        slides: [
          {
            id: 'slide-1',
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
    it('ném lỗi 404 khi bài giảng không tồn tại', async () => {
      mockLectureFindOne.mockResolvedValue(null)

      await expect(
        getLecture('user-1', MISSING_LECTURE_ID)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Không tìm thấy bài giảng'
      })
    })

    it('ném lỗi 404 khi bài giảng đã bị đưa vào thùng rác (deletedAt)', async () => {
      mockLectureFindOne.mockResolvedValue({
        _id: LECTURE_ID,
        userId: 'user-1',
        deletedAt: new Date()
      })

      await expect(getLecture('user-1', LECTURE_ID)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Bài giảng đã bị xóa'
      })
    })

    it('trả về bài giảng khi hợp lệ', async () => {
      const mockLecture = {
        _id: LECTURE_ID,
        userId: 'user-1',
        title: 'Bài giảng của tôi',
        deletedAt: null
      }
      mockLectureFindOne.mockResolvedValue(mockLecture)

      const result = await getLecture('user-1', LECTURE_ID)
      expect(result).toEqual(mockLecture)
    })
  })

  // SRS UC025 (Bảng 2.26)
  describe('duplicateLecture', () => {
    it('tạo bản sao độc lập giữ nguyên theme, dàn ý và thêm hậu tố " - Copy"', async () => {
      const outline = { title: 'TS', sections: [{ heading: 'A', bullets: [] }] }
      mockLectureFindOne.mockResolvedValue({
        _id: LECTURE_ID,
        userId: 'user-1',
        folderId: 'folder-1',
        title: 'Bài gốc',
        prompt: 'p',
        theme: 'modern-obsidian',
        outline,
        contextSummary: 'tóm tắt',
        sourceMaterial: '',
        deletedAt: null,
        slides: [{ id: 's1', components: [{ id: 'c1', type: 'title' }] }]
      })
      mockLectureCreate.mockImplementation(async (doc: unknown) => doc)

      const copy = (await duplicateLecture('user-1', LECTURE_ID)) as any

      expect(copy.title).toBe('Bài gốc - Copy')
      expect(copy.theme).toBe('modern-obsidian')
      expect(copy.outline).toEqual(outline)
      expect(copy.folderId).toBe('folder-1')
      expect(copy.slides[0].id).not.toBe('s1')
      expect(copy.slides[0].components[0].id).not.toBe('c1')
    })
  })

  describe('hardDeleteLecture', () => {
    it('ném lỗi 404 nếu không tìm thấy bài giảng thuộc về user', async () => {
      mockLectureFindOne.mockResolvedValue(null)

      await expect(
        hardDeleteLecture('user-1', MISSING_LECTURE_ID)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Không tìm thấy bài giảng'
      })
    })

    it('xóa vĩnh viễn bài giảng thành công', async () => {
      const mockLecture = {
        _id: LECTURE_ID,
        userId: 'user-1'
      }
      mockLectureFindOne.mockResolvedValue(mockLecture)
      mockLectureDeleteOne.mockResolvedValue({ deletedCount: 1 })

      const result = await hardDeleteLecture('user-1', LECTURE_ID)

      expect(mockLectureDeleteOne).toHaveBeenCalledWith({
        _id: LECTURE_ID,
        userId: 'user-1'
      })
      expect(result).toEqual({ message: 'Đã xóa vĩnh viễn bài giảng' })
    })
  })

  describe('aiChatInEditor', () => {
    it('chỉ gửi đoạn được chọn tới AI và trả văn bản thay thế, giữ nguyên bố cục', async () => {
      const slide = {
        id: 's',
        components: [
          { id: 'p', type: 'text', content: 'Mở đầu. Câu dài. Kết.' },
          { id: 'h', type: 'shape', content: '' }
        ]
      }
      const doc = {
        _id: LECTURE_ID,
        deletedAt: null,
        title: 'Mẫu',
        slides: [slide],
        get: (key: string) => (key === 'aiChatHistory' ? [] : '')
      }
      mockLectureFindOne.mockResolvedValue(doc)
      mockLectureFindOneAndUpdate.mockResolvedValue(doc)
      mockUserFindById.mockResolvedValue({ creditBalance: 10 })
      mockEditSelectedText.mockResolvedValue({
        action: 'UPDATE_CURRENT_SLIDE',
        replacement: 'Gọn.',
        reply: 'Gọn.'
      })
      const before = structuredClone(slide)
      const result = await aiChatInEditor('user-1', LECTURE_ID, {
        message: 'Rút gọn',
        slideId: 's',
        currentSlide: slide,
        selectedCompId: 'p',
        textEdit: { action: 'shorten', start: 8, end: 16 }
      })
      expect(mockEditSelectedText).toHaveBeenCalledWith(
        'shorten',
        'Câu dài.',
        undefined
      )
      expect(mockAiChatAndProposeSlideEdit).not.toHaveBeenCalled()
      expect(result).toMatchObject({ replacement: 'Gọn.', creditSpent: 1 })
      expect(result.proposedSlide).toBeUndefined()
      expect(slide).toEqual(before)
    })

    it('dùng snapshot canvas mới nhất làm context thay cho slide cũ trong database', async () => {
      const persistedSlide = {
        id: 'slide-1',
        title: 'Tiêu đề cũ',
        contentItems: [
          { title: 'Dữ kiện cũ', description: 'Giá trị cũ là 10' }
        ],
        components: [
          {
            id: 'title-slide-1',
            type: 'title',
            content: 'Tiêu đề cũ',
            x: 8,
            y: 10
          }
        ]
      }
      const currentSlideSnapshot = {
        ...persistedSlide,
        title: 'Tiêu đề mới',
        components: [
          {
            id: 'title-slide-1',
            type: 'title',
            content: 'Tiêu đề mới',
            x: 8,
            y: 10
          },
          {
            id: 'body-slide-1',
            type: 'text',
            content: 'Giá trị mới là 42',
            x: 8,
            y: 30
          }
        ]
      }
      const mockLecture = {
        _id: LECTURE_ID,
        title: 'Bài giảng kiểm thử',
        deletedAt: null,
        slides: [persistedSlide],
        get: jest.fn((key: string) => {
          if (key === 'aiChatHistory') return []
          return ''
        }),
        set: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      }
      const mockUser = {
        creditBalance: 10,
        save: jest.fn().mockResolvedValue(true)
      }

      mockLectureFindOne.mockResolvedValue(mockLecture)
      mockLectureFindOneAndUpdate.mockResolvedValue(mockLecture)
      mockUserFindById.mockResolvedValue(mockUser)
      mockAiUsageLogCreate.mockResolvedValue({})
      mockAiChatAndProposeSlideEdit.mockResolvedValue({
        reply: 'Tiêu đề mới, giá trị mới là 42.',
        action: 'CHAT_ONLY',
        targetSlideIndex: 0,
        proposals: []
      })

      await aiChatInEditor('user-1', LECTURE_ID, {
        message: 'Chỉ trả lời, không sửa slide: Nêu tiêu đề và nội dung chính.',
        slideId: 'slide-1',
        currentSlide: currentSlideSnapshot
      })

      // Chỉ trả lời chat, không đổi slide -> không trừ credit
      expect(mockUser.creditBalance).toBe(10)
      expect(mockAiUsageLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({ slideCount: 0, creditSpent: 0 })
      )

      expect(mockAiChatAndProposeSlideEdit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          currentSlide: currentSlideSnapshot,
          outlineOverview: 'Slide 1: Tiêu đề mới',
          slidesCatalog: [
            expect.objectContaining({
              title: 'Tiêu đề mới',
              visibleText: ['Giá trị mới là 42']
            })
          ]
        }),
        undefined
      )
    })

    it('bỏ qua snapshot có ID không khớp slide thuộc bài giảng', async () => {
      const persistedSlide = {
        id: 'slide-owned',
        title: 'Tiêu đề thuộc bài giảng',
        components: [
          {
            id: 'title-slide-owned',
            type: 'title',
            content: 'Tiêu đề thuộc bài giảng'
          }
        ]
      }
      const mockLecture = {
        _id: LECTURE_ID,
        title: 'Bài giảng kiểm thử',
        deletedAt: null,
        slides: [persistedSlide],
        get: jest.fn((key: string) => {
          if (key === 'aiChatHistory') return []
          return ''
        }),
        set: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      }

      mockLectureFindOne.mockResolvedValue(mockLecture)
      mockLectureFindOneAndUpdate.mockResolvedValue(mockLecture)
      mockUserFindById.mockResolvedValue({
        creditBalance: 10,
        save: jest.fn().mockResolvedValue(true)
      })
      mockAiUsageLogCreate.mockResolvedValue({})
      mockAiChatAndProposeSlideEdit.mockResolvedValue({
        reply: 'Tiêu đề thuộc bài giảng.',
        action: 'CHAT_ONLY',
        proposals: []
      })

      await aiChatInEditor('user-1', LECTURE_ID, {
        message: 'Chỉ trả lời: tiêu đề hiện tại là gì?',
        slideId: 'slide-owned',
        currentSlide: {
          id: 'slide-not-owned',
          title: 'Nội dung không hợp lệ'
        }
      })

      expect(mockAiChatAndProposeSlideEdit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ currentSlide: persistedSlide }),
        undefined
      )
    })

    it('tính phí theo số slide mới được AI Chat tạo ra', async () => {
      const persistedSlide = { id: 'slide-1', title: 'Slide hiện tại' }
      const mockLecture = {
        _id: LECTURE_ID,
        title: 'Bài giảng kiểm thử',
        deletedAt: null,
        slides: [persistedSlide],
        get: jest.fn((key: string) => {
          if (key === 'aiChatHistory') return []
          return ''
        }),
        set: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      }
      const mockUser = {
        creditBalance: 20,
        save: jest.fn().mockResolvedValue(true)
      }
      const proposals = Array.from({ length: 3 }, (_, index) => ({
        action: 'CREATE_SLIDE' as const,
        targetSlideIndex: index + 1,
        proposedSlide: {
          id: `new-slide-${index + 1}`,
          title: `Slide mới ${index + 1}`
        }
      }))

      mockLectureFindOne.mockResolvedValue(mockLecture)
      mockLectureFindOneAndUpdate.mockResolvedValue(mockLecture)
      mockUserFindById.mockResolvedValue(mockUser)
      mockAiUsageLogCreate.mockResolvedValue({})
      mockAiChatAndProposeSlideEdit.mockResolvedValue({
        reply: 'Đã tạo 3 slide mới.',
        action: 'BATCH_CHANGES',
        proposals
      })

      const result = await aiChatInEditor('user-1', LECTURE_ID, {
        message: 'Tạo thêm 3 slide',
        slideId: 'slide-1'
      })

      expect(mockUser.creditBalance).toBe(14)
      expect(mockAiUsageLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          slideCount: 3,
          creditSpent: 6
        })
      )
      expect(result.creditSpent).toBe(6)
      expect(result.creditBalance).toBe(14)
    })

    it('giới hạn số slide AI đề xuất theo credit và chỉ tính phí các slide được giữ lại', async () => {
      const persistedSlide = { id: 'slide-1', title: 'Slide hiện tại' }
      const mockLecture = {
        _id: LECTURE_ID,
        title: 'Bài giảng kiểm thử',
        deletedAt: null,
        slides: [persistedSlide],
        get: jest.fn(() => ''),
        set: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      }
      const mockUser = {
        creditBalance: 5,
        save: jest.fn().mockResolvedValue(true)
      }

      mockLectureFindOne.mockResolvedValue(mockLecture)
      mockLectureFindOneAndUpdate.mockResolvedValue(mockLecture)
      mockUserFindById.mockResolvedValue(mockUser)
      mockAiChatAndProposeSlideEdit.mockResolvedValue({
        reply: 'Đã tạo 3 slide mới.',
        action: 'BATCH_CHANGES',
        proposals: Array.from({ length: 3 }, (_, index) => ({
          action: 'CREATE_SLIDE',
          targetSlideIndex: index + 1,
          proposedSlide: {
            id: `new-slide-${index + 1}`,
            title: `Slide mới ${index + 1}`
          }
        }))
      })

      const result = await aiChatInEditor('user-1', LECTURE_ID, {
        message: 'Tạo thêm 3 slide',
        slideId: 'slide-1'
      })

      expect(mockAiChatAndProposeSlideEdit).toHaveBeenCalledWith(
        'Tạo thêm 3 slide',
        expect.objectContaining({
          creditBalance: 5,
          pricePerSlide: 2,
          maxCreatableSlides: 2
        }),
        undefined
      )
      expect(result.proposals).toHaveLength(2)
      expect(result.creditSpent).toBe(4)
      expect(result.creditBalance).toBe(1)
      expect(mockUser.creditBalance).toBe(1)
      expect(mockDebitCredits).toHaveBeenCalledWith(
        'user-1',
        4,
        expect.any(String)
      )
      expect(mockLectureFindOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: LECTURE_ID,
          userId: 'user-1',
          deletedAt: null,
          updatedAt: undefined,
          'aiChatHistory.0': { $exists: false },
          $or: [{ revision: 0 }, { revision: { $exists: false } }]
        },
        expect.objectContaining({
          $set: expect.objectContaining({
            aiChatHistory: expect.arrayContaining([
              expect.objectContaining({ role: 'user' }),
              expect.objectContaining({ role: 'assistant' })
            ])
          })
        }),
        { new: true }
      )
      expect(mockAiUsageLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({ slideCount: 2, creditSpent: 4 })
      )
    })
  })
})

describe('huỷ sau khi Mongo đã ghi dữ liệu AI', () => {
  const userId = '1'.repeat(24)
  const outline = {
    title: 'Dàn ý',
    sections: [{ heading: 'Chương 1', bullets: ['Ý 1'] }]
  }
  it.each([
    'outline-new',
    'outline-delivery-new',
    'outline-existing',
    'lecture-new',
    'lecture-existing',
    'chat'
  ] as const)(
    '%s hoàn tác nội dung, credit và usage, ghi kết quả theo request ID',
    async (scenario) => {
      jest.clearAllMocks()
      const kind = scenario.startsWith('outline')
        ? 'outline'
        : scenario.startsWith('lecture')
          ? 'lecture'
          : 'chat'
      const created = scenario.endsWith('-new')
      const user = { creditBalance: 40 }
      const oldFields: Record<string, unknown> = {
        prompt: 'cũ',
        title: 'Cũ',
        outline: null,
        theme: 'old',
        slides: [{ id: 'slide-1' }],
        folderId: null,
        aiChatHistory: [],
        sourceMaterial: 'cũ',
        contextSummary: 'cũ'
      }
      const original = {
        ...oldFields,
        _id: LECTURE_ID,
        userId,
        revision: 3,
        updatedAt: new Date(0),
        deletedAt: null,
        get: (key: string) => oldFields[key]
      }
      const written = {
        ...original,
        updatedAt: new Date(1),
        revision: created ? 0 : kind === 'chat' ? 3 : 4
      }
      mockUserFindById.mockResolvedValue(user)
      mockLectureFindOne.mockResolvedValue(original)
      mockLectureCreate.mockResolvedValue(written)
      mockLectureFindOneAndUpdate.mockResolvedValue(written)
      mockLectureDeleteOne.mockResolvedValue({ deletedCount: 1 })
      mockUpdateOne.mockResolvedValue({ matchedCount: 1 })
      mockAiGenerateOutlineFromPrompt.mockResolvedValue(outline)
      mockAiGenerateSlidesFromOutline.mockResolvedValue([
        { id: 's', title: 'Mới', bullets: [] }
      ])
      mockAiChatAndProposeSlideEdit.mockResolvedValue({
        reply: 'Đã sửa',
        action: 'UPDATE_CURRENT_SLIDE',
        updatedSummary: 'mới'
      })
      mockUsageDelete.mockResolvedValue({ deletedCount: 1 })
      mockAuditSet.mockResolvedValue('OK')
      const req = Object.assign(new EventEmitter(), {
        user: { id: userId }
      }) as Request
      const res = Object.assign(new EventEmitter(), {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: () => res.emit('close')
      }) as unknown as Response
      mockAiUsageLogCreate.mockImplementation(async () => {
        if (scenario !== 'outline-delivery-new') res.emit('close')
        return { _id: 'log' }
      })
      await expect(
        requestContext.run({ requestId: 'cancel-123', userId }, () =>
          withAiRequest<unknown>(req, res, kind, (signal) => {
            if (kind === 'outline')
              return generateOutline(
                userId,
                'Chủ đề mới',
                created ? undefined : { lectureId: LECTURE_ID },
                signal
              )
            if (kind === 'lecture')
              return createLecture(
                userId,
                {
                  title: 'Mới',
                  outline,
                  lectureId: created ? undefined : LECTURE_ID
                },
                signal
              )
            return aiChatInEditor(
              userId,
              LECTURE_ID,
              { message: 'Sửa', sourceMaterial: 'mới' },
              signal
            )
          })
        )
      ).rejects.toMatchObject({ statusCode: 499 })
      expect(user.creditBalance).toBe(40)
      expect(mockUsageDelete).toHaveBeenCalledWith({ _id: 'log' })
      if (created) {
        expect(mockLectureDeleteOne).toHaveBeenCalledWith({
          _id: LECTURE_ID,
          userId,
          deletedAt: null,
          updatedAt: written.updatedAt,
          'aiChatHistory.0': { $exists: false },
          $or: [{ revision: 0 }, { revision: { $exists: false } }]
        })
      } else {
        const fields =
          kind === 'outline'
            ? ['prompt', 'outline']
            : kind === 'lecture'
              ? ['title', 'prompt', 'outline', 'slides', 'theme', 'folderId']
              : ['sourceMaterial', 'contextSummary', 'aiChatHistory']
        expect(mockUpdateOne).toHaveBeenCalledWith(
          expect.objectContaining({
            revision: written.revision,
            updatedAt: written.updatedAt
          }),
          {
            $set: {
              ...Object.fromEntries(fields.map((k) => [k, oldFields[k]])),
              revision: 3,
              updatedAt: original.updatedAt
            }
          },
          { timestamps: false }
        )
      }
      const task = JSON.parse(mockAuditSet.mock.calls.at(-1)![1])
      expect(task).toMatchObject({
        requestId: 'cancel-123',
        kind,
        status: 'cancelled',
        httpStatus: 499,
        lectureRestored: true,
        usageLogId: null,
        lectureId: LECTURE_ID
      })
      expect(task.creditDebited).toBeGreaterThan(0)
      expect(task.creditRefunded).toBe(task.creditDebited)
    }
  )
})
