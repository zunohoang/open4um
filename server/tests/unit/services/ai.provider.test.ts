type AiService = typeof import('@/services/ai.service')

const outline = {
  title: 'CI/CD',
  sections: [{ heading: 'Pipeline', bullets: ['Build', 'Deploy'] }]
}

const loadService = (baseUrl?: string, model = 'gemini-3.8-flash') => {
  jest.resetModules()
  jest.doMock('@/config/env', () => ({
    env: {
      GEMINI_API_KEY: 'test-shop-key',
      GEMINI_BASE_URL: baseUrl,
      GEMINI_MODEL: model
    }
  }))
  return require('@/services/ai.service') as AiService
}

const mockResponse = (payload: unknown) =>
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }]
    })
  } as Response)

const shopUrl =
  'https://api.shopaikey.com/v1beta/models/gemini-3.8-flash:generateContent?key=test-shop-key'

describe('AI provider routing', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    jest.dontMock('@/config/env')
  })

  it('sinh outline bằng endpoint và model được cấu hình', async () => {
    const service = loadService('https://api.shopaikey.com')
    const fetchMock = mockResponse(outline)
    await expect(service.generateOutlineFromPrompt('CI/CD')).resolves.toEqual(
      outline
    )
    expect(fetchMock).toHaveBeenCalledWith(
      shopUrl,
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('tinh chỉnh outline cũng dùng cùng provider', async () => {
    const service = loadService('https://api.shopaikey.com')
    const fetchMock = mockResponse(outline)
    await service.refineOutlineWithFeedback(outline, 'CI/CD', 'Thêm ví dụ')
    expect(fetchMock).toHaveBeenCalledWith(shopUrl, expect.any(Object))
  })

  it('tạo slides cũng dùng cùng provider', async () => {
    const service = loadService('https://api.shopaikey.com')
    const fetchMock = mockResponse({
      slides: [{ title: 'Pipeline', bullets: ['Build', 'Deploy'] }]
    })
    const slides = await service.generateSlidesFromOutline(outline, 'CI/CD')
    expect(slides).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith(shopUrl, expect.any(Object))
  })

  it('chỉnh sửa slide cũng dùng cùng provider', async () => {
    const service = loadService('https://api.shopaikey.com')
    const slide = { id: 'slide-1', title: 'Pipeline', bullets: ['Build'] }
    const fetchMock = mockResponse(slide)
    await service.editSlideWithInstruction(slide, 'Rút gọn')
    expect(fetchMock).toHaveBeenCalledWith(shopUrl, expect.any(Object))
  })

  it('giữ endpoint Google khi không cấu hình proxy', async () => {
    const service = loadService(undefined, 'gemini-3.5-flash')
    const fetchMock = mockResponse(outline)
    await service.generateOutlineFromPrompt('CI/CD')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=test-shop-key',
      expect.any(Object)
    )
  })
})
