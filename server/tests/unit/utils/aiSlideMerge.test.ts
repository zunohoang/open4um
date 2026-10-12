import {
  extractRequestedHintLabel,
  isShortHintAdditionRequest,
  mergeShortHintIntoSlide
} from '@/utils/aiSlideMerge'

describe('aiSlideMerge', () => {
  const exactRequest =
    'Chỉ bổ sung một gợi ý ngắn vào slide hiện tại. Thêm nhãn ‘V1’ ngay trước gợi ý. Giữ nguyên đề bài, mọi câu chữ có sẵn và tất cả slide khác.'

  it('nhận diện yêu cầu bổ sung tối thiểu và trích xuất đúng nhãn V1', () => {
    expect(isShortHintAdditionRequest(exactRequest)).toBe(true)
    expect(extractRequestedHintLabel(exactRequest)).toBe('V1')
  })

  it('cưỡng chế nhãn V1 và giữ nguyên toàn bộ câu chữ có sẵn', () => {
    const originalSlide = {
      id: 'slide-exercise',
      title: 'Bài tập đọc hiểu',
      subtitle: 'Làm việc cá nhân',
      bullets: ['Chọn một quyển sách', 'Ghi lại ba ý chính'],
      contentItems: [
        {
          title: 'Nhiệm vụ',
          description: 'Hãy chọn một quyển sách em yêu thích.'
        }
      ],
      components: [
        {
          id: 'title-slide-exercise',
          type: 'title',
          content: 'Bài tập đọc hiểu'
        },
        {
          id: 'body-slide-exercise',
          type: 'text',
          content: 'Hãy chọn một quyển sách em yêu thích.'
        },
        {
          id: 'sub-slide-exercise',
          type: 'subtitle',
          content: 'Làm việc cá nhân'
        }
      ]
    }
    const proposedByAi = {
      title: 'Bài tập đọc',
      subtitle: 'Gợi ý: Tìm từ khóa mô tả chủ đề trước khi chọn sách.',
      bullets: ['Chọn quyển sách', 'Ghi ba ý chính'],
      contentItems: [
        {
          title: 'Nhiệm vụ',
          description: 'Hãy chọn quyển sách em thích.'
        }
      ]
    }

    const result = mergeShortHintIntoSlide(originalSlide, proposedByAi, 'V1')

    expect(result.title).toBe(originalSlide.title)
    expect(result.bullets).toEqual(originalSlide.bullets)
    expect(result.contentItems).toEqual(originalSlide.contentItems)
    expect(result.subtitle).toBe(
      'Làm việc cá nhân\nV1: Gợi ý: Tìm từ khóa mô tả chủ đề trước khi chọn sách.'
    )
    expect(result.components).toEqual([
      originalSlide.components[0],
      originalSlide.components[1],
      {
        ...originalSlide.components[2],
        content:
          'Làm việc cá nhân\nV1: Gợi ý: Tìm từ khóa mô tả chủ đề trước khi chọn sách.'
      }
    ])
    expect(JSON.stringify(result)).toContain('một quyển sách')
    expect(JSON.stringify(result)).not.toContain('Chọn quyển sách')
  })

  it('không lặp nhãn khi AI đã tự trả về V1', () => {
    const result = mergeShortHintIntoSlide(
      {
        id: 'slide-1',
        title: 'Bài tập',
        bullets: [],
        components: []
      },
      {
        subtitle: 'V1: Gợi ý: Đọc kỹ dữ kiện trước khi trả lời.'
      },
      'V1'
    )

    expect(result.subtitle).toBe('V1: Gợi ý: Đọc kỹ dữ kiện trước khi trả lời.')
    expect((String(result.subtitle).match(/V1/g) || []).length).toBe(1)
  })

  it('không sửa footer hoặc khối nội dung cũ khi slide chưa có subtitle', () => {
    const originalComponents = [
      {
        id: 'body-slide-1',
        type: 'text',
        content: 'Hãy chọn một quyển sách.'
      },
      {
        id: 'footer-slide-1',
        type: 'text',
        content: 'Trang 1'
      }
    ]

    const result = mergeShortHintIntoSlide(
      {
        id: 'slide-1',
        title: 'Bài tập',
        bullets: [],
        components: originalComponents
      },
      { subtitle: 'Gợi ý: Đọc kỹ yêu cầu trước khi trả lời.' },
      'V1'
    )

    expect(result.components).toEqual([
      ...originalComponents,
      expect.objectContaining({
        id: 'ai-hint-slide-1',
        content: 'V1: Gợi ý: Đọc kỹ yêu cầu trước khi trả lời.'
      })
    ])
  })
})
