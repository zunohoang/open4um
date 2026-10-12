const mockGenerateContent = jest.fn()

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: (...args: any[]) => mockGenerateContent(...args)
    }
  }))
}))

import { chatAndProposeSlideEdit } from '@/services/ai.service'

describe('ai.service chatAndProposeSlideEdit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('chỉ thêm gợi ý V1 vào slide hiện tại dù AI trả về thay đổi ngoài phạm vi', async () => {
    const currentSlide = {
      id: 'slide-1',
      title: 'Bài tập đọc hiểu',
      subtitle: 'Làm việc cá nhân',
      bullets: ['Chọn một quyển sách'],
      contentItems: [
        {
          title: 'Nhiệm vụ',
          description: 'Hãy chọn một quyển sách em yêu thích.'
        }
      ],
      components: [
        {
          id: 'title-slide-1',
          type: 'title',
          content: 'Bài tập đọc hiểu'
        },
        {
          id: 'body-slide-1',
          type: 'text',
          content: 'Hãy chọn một quyển sách em yêu thích.'
        },
        {
          id: 'sub-slide-1',
          type: 'subtitle',
          content: 'Làm việc cá nhân'
        }
      ]
    }
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        reply: 'Đã bổ sung gợi ý.',
        action: 'BATCH_CHANGES',
        proposals: [
          {
            action: 'UPDATE_SLIDE',
            targetSlideIndex: 1,
            proposedSlide: {
              id: 'slide-2',
              title: 'Slide khác đã bị viết lại',
              subtitle: 'Nội dung ngoài phạm vi'
            }
          },
          {
            action: 'UPDATE_SLIDE',
            targetSlideIndex: 0,
            proposedSlide: {
              ...currentSlide,
              title: 'Bài tập đọc',
              subtitle: 'Gợi ý: Tìm từ khóa mô tả chủ đề trước khi chọn sách.',
              bullets: ['Chọn quyển sách']
            }
          }
        ]
      })
    })

    const result = await chatAndProposeSlideEdit(
      'Chỉ bổ sung một gợi ý ngắn vào slide hiện tại. Thêm nhãn ‘V1’ ngay trước gợi ý. Giữ nguyên đề bài, mọi câu chữ có sẵn và tất cả slide khác.',
      {
        presentationTitle: 'Bài giảng',
        totalSlides: 2,
        currentSlideIndex: 0,
        currentSlide,
        slidesCatalog: [
          {
            slideNumber: 1,
            id: 'slide-1',
            title: currentSlide.title,
            bullets: currentSlide.bullets,
            layout: 'cards'
          },
          {
            slideNumber: 2,
            id: 'slide-2',
            title: 'Slide không liên quan',
            bullets: [],
            layout: 'cards'
          }
        ]
      }
    )

    expect(result.action).toBe('UPDATE_SLIDE')
    expect(result.targetSlideIndex).toBe(0)
    expect(result.proposals).toHaveLength(1)
    expect(result.proposedSlide).toEqual(
      expect.objectContaining({
        id: 'slide-1',
        title: currentSlide.title,
        bullets: currentSlide.bullets,
        contentItems: currentSlide.contentItems,
        subtitle:
          'Làm việc cá nhân\nV1: Gợi ý: Tìm từ khóa mô tả chủ đề trước khi chọn sách.'
      })
    )
    expect(JSON.stringify(result.proposedSlide)).toContain('một quyển sách')
    expect(JSON.stringify(result.proposedSlide)).not.toContain(
      'Slide khác đã bị viết lại'
    )

    const request = mockGenerateContent.mock.calls[0][0]
    expect(request.contents).toContain('"V1: Gợi ý: ..."')
    expect(request.contents).toContain('BẮT BUỘC giữ nguyên nhãn "V1"')
  })
})
