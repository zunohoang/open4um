import {
  generateOutlineSchema,
  createLectureSchema,
  createBlankLectureSchema,
  updateLectureSchema,
  aiEditSlideSchema,
  slideOperationSchema
} from '@/validators/lecture.validator'

describe('generateOutlineSchema', () => {
  it('thành công khi truyền prompt hợp lệ (tối thiểu 5 ký tự)', () => {
    const result = generateOutlineSchema.safeParse({
      prompt: 'Tạo bài giảng về Machine Learning'
    })
    expect(result.success).toBe(true)
  })

  it('thất bại khi prompt rỗng hoặc ngắn hơn 5 ký tự', () => {
    const emptyResult = generateOutlineSchema.safeParse({ prompt: '' })
    expect(emptyResult.success).toBe(false)

    const shortResult = generateOutlineSchema.safeParse({ prompt: 'abc' })
    expect(shortResult.success).toBe(false)
  })
})

describe('createLectureSchema', () => {
  it('thành công khi đủ title, pattern và outline hợp lệ', () => {
    const result = createLectureSchema.safeParse({
      title: 'Nhập môn TypeScript',
      pattern: 'default',
      outline: {
        title: 'Outline TypeScript',
        sections: [
          {
            heading: 'Giới thiệu',
            bullets: ['Định nghĩa', 'Lịch sử phát triển']
          }
        ]
      }
    })
    expect(result.success).toBe(true)
  })

  it('thất bại khi thiếu title hoặc pattern', () => {
    const result = createLectureSchema.safeParse({
      pattern: 'default',
      outline: {
        title: 'Outline',
        sections: []
      }
    })
    expect(result.success).toBe(false)
  })
})

describe('createBlankLectureSchema', () => {
  it('thành công khi có title hợp lệ', () => {
    const result = createBlankLectureSchema.safeParse({
      title: 'Bài giảng không tên'
    })
    expect(result.success).toBe(true)
  })

  it('thất bại khi thiếu title hoặc title rỗng', () => {
    const missingTitle = createBlankLectureSchema.safeParse({})
    expect(missingTitle.success).toBe(false)

    const emptyTitle = createBlankLectureSchema.safeParse({ title: '' })
    expect(emptyTitle.success).toBe(false)
  })

  it('thành công khi truyền kèm folderId', () => {
    const result = createBlankLectureSchema.safeParse({
      title: 'Bài giảng mới',
      folderId: '507f1f77bcf86cd799439011'
    })
    expect(result.success).toBe(true)
  })
})

describe('updateLectureSchema', () => {
  it('thành công khi cập nhật title', () => {
    const result = updateLectureSchema.safeParse({
      title: 'Tiêu đề mới'
    })
    expect(result.success).toBe(true)
  })

  it('thành công khi cập nhật slides hợp lệ', () => {
    const result = updateLectureSchema.safeParse({
      slides: [
        {
          id: 'slide-1',
          elements: []
        }
      ]
    })
    expect(result.success).toBe(true)
  })
})

describe('aiEditSlideSchema', () => {
  it('thành công với slideId và instruction hợp lệ', () => {
    const result = aiEditSlideSchema.safeParse({
      slideId: 'slide-1',
      instruction: 'Đổi màu nền sang xanh lam và làm nổi bật tiêu đề'
    })
    expect(result.success).toBe(true)
  })

  it('thất bại khi thiếu instruction', () => {
    const result = aiEditSlideSchema.safeParse({
      slideId: 'slide-1'
    })
    expect(result.success).toBe(false)
  })
})

describe('slideOperationSchema', () => {
  it('thành công với operation add', () => {
    const result = slideOperationSchema.safeParse({
      operation: 'add',
      index: 0
    })
    expect(result.success).toBe(true)
  })

  it('thành công với operation delete', () => {
    const result = slideOperationSchema.safeParse({
      operation: 'delete',
      slideId: 'slide-1'
    })
    expect(result.success).toBe(true)
  })

  it('thất bại với operation không hợp lệ', () => {
    const result = slideOperationSchema.safeParse({
      operation: 'invalid_op',
      slideId: 'slide-1'
    })
    expect(result.success).toBe(false)
  })
})
