// Mock dependencies
const mockUserFindById = jest.fn()
const mockUserFindOne = jest.fn()
const mockFolderFindOne = jest.fn()
const mockLectureCreate = jest.fn()
const mockLectureFindOne = jest.fn()
const mockLectureFind = jest.fn()
const mockLectureDeleteOne = jest.fn()
const mockLectureFindOneAndUpdate = jest.fn()
const mockAiUsageLogCreate = jest.fn()
const mockAiGenerateOutlineFromPrompt = jest.fn()
const mockAiRefineOutlineWithFeedback = jest.fn()
const mockAiGenerateSlidesFromOutline = jest.fn()
const mockAiBuildSlidesFromOutline = jest.fn()
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
    find: (...args: any[]) => mockLectureFind(...args),
    deleteOne: (...args: any[]) => mockLectureDeleteOne(...args),
    findOneAndUpdate: (...args: any[]) => mockLectureFindOneAndUpdate(...args)
  }
}))

jest.mock('@/models/aiUsageLog.model', () => ({
  AiUsageLogModel: {
    create: (...args: any[]) => mockAiUsageLogCreate(...args)
  }
}))

jest.mock('@/services/ai.service', () => ({
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
    pricePerLecture: 20,
    pricePerSlide: 2,
    pricePerAiEdit: 1,
    pricePerOutline: 4,
    signupBonus: 20
  })
}))

jest.mock('@/services/credit.service', () => ({
  debitCredits: (...args: any[]) => mockDebitCredits(...args),
  refundCredits: (...args: any[]) => mockRefundCredits(...args)
}))

import {
  generateOutline,
  createLecture,
  createBlankLecture,
  getLecture,
  hardDeleteLecture,
  aiChatInEditor,
  applySlideOperation
} from '@/services/lecture.service'

describe('lecture.service unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
        _id: 'draft-lec-1',
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
          slideCount: 2,
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
        _id: 'existing-lec-1',
        title: 'Bản mới điều chỉnh',
        prompt: 'Prompt gốc',
        outline: refinedOutline
      }
      mockLectureFindOneAndUpdate.mockResolvedValue(mockUpdatedLecture)

      const result = await generateOutline('user-refine', 'Prompt gốc', {
        feedback: 'Thêm phần thực hành',
        currentOutline,
        lectureId: 'existing-lec-1'
      })

      expect(mockAiRefineOutlineWithFeedback).toHaveBeenCalledWith(
        currentOutline,
        'Prompt gốc',
        'Thêm phần thực hành'
      )
      expect(mockLectureFindOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'existing-lec-1', userId: 'user-refine' },
        expect.objectContaining({
          title: 'Bản mới điều chỉnh',
          outline: refinedOutline
        }),
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

    it('ném lỗi 402 trước khi gọi AI nếu không đủ phí sinh bài giảng cố định', async () => {
      mockUserFindById.mockResolvedValue({
        _id: 'user-poor',
        creditBalance: 19,
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

    it('tính phí cố định khi sinh bài giảng, không phụ thuộc số slide', async () => {
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
        _id: 'lec-1',
        title: 'TypeScript cơ bản',
        slides: mockSlides,
        toObject: () => ({
          _id: 'lec-1',
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

      // Phí sinh bài giảng cố định là 20 credits -> 50 - 20 = 30
      expect(mockUser.creditBalance).toBe(30)
      expect(mockDebitCredits).toHaveBeenCalledWith(
        'user-rich',
        20,
        expect.any(String)
      )
      expect(mockAiUsageLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-rich',
          slideCount: 8,
          creditSpent: 20
        })
      )
      expect(result).toHaveProperty('creditSpent', 20)
      expect(result).toHaveProperty('creditBalance', 30)
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
        _id: 'existing-lec-123',
        title: 'TypeScript cơ bản',
        slides: mockSlides,
        toObject: () => ({
          _id: 'existing-lec-123',
          title: 'TypeScript cơ bản',
          slides: mockSlides
        })
      }
      mockLectureFindOneAndUpdate.mockResolvedValue(mockUpdated)

      const result = await createLecture('user-rich', {
        lectureId: 'existing-lec-123',
        title: 'TypeScript cơ bản',
        prompt: 'Dạy TS',
        outline: fakeOutline
      })

      expect(mockLectureFindOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'existing-lec-123', userId: 'user-rich' },
        expect.objectContaining({
          title: 'TypeScript cơ bản',
          slides: expect.arrayContaining([
            expect.objectContaining({ id: 's1', title: 'Slide 1' })
          ])
        }),
        { new: true, upsert: true }
      )
      expect(result._id).toBe('existing-lec-123')
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

  describe('hardDeleteLecture', () => {
    it('ném lỗi 404 nếu không tìm thấy bài giảng thuộc về user', async () => {
      mockLectureFindOne.mockResolvedValue(null)

      await expect(
        hardDeleteLecture('user-1', 'lecture-999')
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Không tìm thấy bài giảng'
      })
    })

    it('xóa vĩnh viễn bài giảng thành công', async () => {
      const mockLecture = {
        _id: 'lecture-123',
        userId: 'user-1'
      }
      mockLectureFindOne.mockResolvedValue(mockLecture)
      mockLectureDeleteOne.mockResolvedValue({ deletedCount: 1 })

      const result = await hardDeleteLecture('user-1', 'lecture-123')

      expect(mockLectureDeleteOne).toHaveBeenCalledWith({
        _id: 'lecture-123',
        userId: 'user-1'
      })
      expect(result).toEqual({ message: 'Đã xóa vĩnh viễn bài giảng' })
    })
  })

  describe('aiChatInEditor', () => {
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
        _id: 'lecture-123',
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
      mockUserFindById.mockResolvedValue(mockUser)
      mockAiUsageLogCreate.mockResolvedValue({})
      mockAiChatAndProposeSlideEdit.mockResolvedValue({
        reply: 'Tiêu đề mới, giá trị mới là 42.',
        action: 'CHAT_ONLY',
        targetSlideIndex: 0,
        proposals: []
      })

      await aiChatInEditor('user-1', 'lecture-123', {
        message: 'Chỉ trả lời, không sửa slide: Nêu tiêu đề và nội dung chính.',
        slideId: 'slide-1',
        currentSlide: currentSlideSnapshot
      })

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
        })
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

      await aiChatInEditor('user-1', 'lecture-123', {
        message: 'Chỉ trả lời: tiêu đề hiện tại là gì?',
        slideId: 'slide-owned',
        currentSlide: {
          id: 'slide-not-owned',
          title: 'Nội dung không hợp lệ'
        }
      })

      expect(mockAiChatAndProposeSlideEdit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ currentSlide: persistedSlide })
      )
    })

    it('tính phí theo số slide mới được AI Chat tạo ra', async () => {
      const persistedSlide = { id: 'slide-1', title: 'Slide hiện tại' }
      const mockLecture = {
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
      mockUserFindById.mockResolvedValue(mockUser)
      mockAiUsageLogCreate.mockResolvedValue({})
      mockAiChatAndProposeSlideEdit.mockResolvedValue({
        reply: 'Đã tạo 3 slide mới.',
        action: 'BATCH_CHANGES',
        proposals
      })

      const result = await aiChatInEditor('user-1', 'lecture-123', {
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

    it('không trừ credit hoặc lưu lịch sử nếu không đủ phí cho số slide AI Chat tạo ra', async () => {
      const persistedSlide = { id: 'slide-1', title: 'Slide hiện tại' }
      const mockLecture = {
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

      const result = await aiChatInEditor('user-1', 'lecture-123', {
        message: 'Tạo thêm 3 slide',
        slideId: 'slide-1'
      })

      expect(mockAiChatAndProposeSlideEdit).toHaveBeenCalledWith(
        'Tạo thêm 3 slide',
        expect.objectContaining({
          creditBalance: 5,
          pricePerSlide: 2,
          maxCreatableSlides: 2
        })
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
      expect(mockLecture.save).toHaveBeenCalled()
      expect(mockAiUsageLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({ slideCount: 2, creditSpent: 4 })
      )
    })
  })

  describe('applySlideOperation', () => {
    it('thêm slide mới thành công tại chỉ số chỉ định', async () => {
      const mockLecture = {
        _id: 'lecture-123',
        userId: 'user-1',
        slides: [{ id: 's1', title: 'Slide 1' }],
        set: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      }
      mockLectureFindOne.mockResolvedValue(mockLecture)

      const result = await applySlideOperation('user-1', 'lecture-123', {
        operation: 'add',
        index: 1
      })

      expect(mockLecture.set).toHaveBeenCalledWith(
        'slides',
        expect.arrayContaining([
          expect.objectContaining({ id: 's1' }),
          expect.objectContaining({
            id: expect.stringMatching(/^slide-/),
            title: '',
            bullets: []
          })
        ])
      )
      expect(mockLecture.save).toHaveBeenCalled()
      expect(result).toBe(mockLecture)
    })

    it('ném lỗi 400 khi cố xóa slide duy nhất còn lại', async () => {
      const mockLecture = {
        _id: 'lecture-123',
        userId: 'user-1',
        slides: [{ id: 's1', title: 'Slide 1' }],
        set: jest.fn(),
        save: jest.fn()
      }
      mockLectureFindOne.mockResolvedValue(mockLecture)

      await expect(
        applySlideOperation('user-1', 'lecture-123', {
          operation: 'delete',
          slideId: 's1'
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Bài giảng phải có ít nhất một slide'
      })
      expect(mockLecture.save).not.toHaveBeenCalled()
    })

    it('xóa slide thành công khi bài giảng có nhiều hơn 1 slide', async () => {
      const mockLecture = {
        _id: 'lecture-123',
        userId: 'user-1',
        slides: [
          { id: 's1', title: 'Slide 1' },
          { id: 's2', title: 'Slide 2' }
        ],
        set: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      }
      mockLectureFindOne.mockResolvedValue(mockLecture)

      await applySlideOperation('user-1', 'lecture-123', {
        operation: 'delete',
        slideId: 's1'
      })

      expect(mockLecture.set).toHaveBeenCalledWith('slides', [
        { id: 's2', title: 'Slide 2' }
      ])
      expect(mockLecture.save).toHaveBeenCalled()
    })

    it('nhân bản slide và tự động tạo mới ID cho các component con', async () => {
      const mockLecture = {
        _id: 'lecture-123',
        userId: 'user-1',
        slides: [
          {
            id: 's1',
            title: 'Slide 1',
            components: [
              { id: 'comp-old-1', type: 'title', content: 'Tiêu đề' },
              { id: 'comp-old-2', type: 'bullets', content: 'Ý 1' }
            ]
          }
        ],
        set: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      }
      mockLectureFindOne.mockResolvedValue(mockLecture)

      await applySlideOperation('user-1', 'lecture-123', {
        operation: 'duplicate',
        slideId: 's1'
      })

      const updatedSlides = mockLecture.set.mock.calls[0][1]
      expect(updatedSlides).toHaveLength(2)
      expect(updatedSlides[0].id).toBe('s1')
      expect(updatedSlides[1].id).toMatch(/^slide-/)
      expect(updatedSlides[1].id).not.toBe('s1')
      // Đảm bảo components của slide nhân bản có ID mới khác với bản gốc
      expect(updatedSlides[1].components[0].id).toMatch(/^comp-/)
      expect(updatedSlides[1].components[0].id).not.toBe('comp-old-1')
      expect(updatedSlides[1].components[1].id).toMatch(/^comp-/)
      expect(updatedSlides[1].components[1].id).not.toBe('comp-old-2')
      expect(updatedSlides[1].components[0].content).toBe('Tiêu đề')
    })

    it('di chuyển slide đến vị trí đích chính xác', async () => {
      const mockLecture = {
        _id: 'lecture-123',
        userId: 'user-1',
        slides: [
          { id: 's1', title: 'Slide 1' },
          { id: 's2', title: 'Slide 2' },
          { id: 's3', title: 'Slide 3' }
        ],
        set: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      }
      mockLectureFindOne.mockResolvedValue(mockLecture)

      await applySlideOperation('user-1', 'lecture-123', {
        operation: 'move',
        slideId: 's1',
        toIndex: 2
      })

      const updatedSlides = mockLecture.set.mock.calls[0][1]
      expect(updatedSlides.map((s: { id: string }) => s.id)).toEqual([
        's2',
        's3',
        's1'
      ])
    })
  })
})
