const mockPutObject = jest.fn()
const mockStatObject = jest.fn()
const mockGetObject = jest.fn()
const mockFindOne = jest.fn()
const mockExists = jest.fn()

jest.mock('@/lib/minio', () => ({
  BUCKET_MEDIA: 'media',
  minioClient: {
    putObject: (...args: unknown[]) => mockPutObject(...args),
    statObject: (...args: unknown[]) => mockStatObject(...args),
    getObject: (...args: unknown[]) => mockGetObject(...args)
  },
  minioPresignClient: {}
}))

jest.mock('@/models/lecture.model', () => ({
  LectureModel: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
    exists: (...args: unknown[]) => mockExists(...args)
  }
}))

import { getImage, getLecture, uploadImage } from '@/services/lecture.service'

const USER_ID = 'a'.repeat(24)
const LECTURE_ID = 'b'.repeat(24)
const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4Y6MBAAM4AUGx7UnvAAAAAElFTkSuQmCC'

describe('SRS UC011 - upload ảnh lên server', () => {
  beforeEach(() => jest.clearAllMocks())

  it('lưu ảnh PNG hợp lệ vào MinIO với key theo user và UUID', async () => {
    const { key } = await uploadImage(
      USER_ID,
      `data:image/png;base64,${PNG_1PX}`
    )

    expect(key).toMatch(new RegExp(`^images/${USER_ID}/[0-9a-f-]{36}[.]png$`))
    expect(mockPutObject).toHaveBeenCalledWith(
      'media',
      key,
      expect.any(Buffer),
      expect.any(Number),
      { 'Content-Type': 'image/png' }
    )
  })

  it.each([
    ['SVG (có thể chứa script)', 'data:image/svg+xml;base64,PHN2Zy8+'],
    ['không phải data URL', 'https://example.com/a.png'],
    ['định dạng BMP', 'data:image/bmp;base64,Qk0='],
    ['base64 chứa ký tự lạ', 'data:image/png;base64,<script>']
  ])('4a - từ chối %s với 422', async (_name, dataUrl) => {
    await expect(uploadImage(USER_ID, dataUrl)).rejects.toMatchObject({
      statusCode: 422
    })
    expect(mockPutObject).not.toHaveBeenCalled()
  })

  it('4a - từ chối ảnh lớn hơn 5MB với 413', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64')
    await expect(
      uploadImage(USER_ID, `data:image/png;base64,${big}`)
    ).rejects.toMatchObject({ statusCode: 413 })
    expect(mockPutObject).not.toHaveBeenCalled()
  })

  it('getImage chặn key sai định dạng (path traversal) bằng 404', async () => {
    await expect(getImage('images/../secrets.txt')).rejects.toMatchObject({
      statusCode: 404
    })
    expect(mockStatObject).not.toHaveBeenCalled()
  })

  it('getImage trả 404 khi ảnh không tồn tại trong MinIO', async () => {
    mockStatObject.mockRejectedValue(new Error('NotFound'))
    await expect(
      getImage(
        `images/${USER_ID}/${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}.png`
      )
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('SRS UC009 2a - quyền truy cập bài giảng', () => {
  beforeEach(() => jest.clearAllMocks())

  it('trả 403 khi bài giảng tồn tại nhưng thuộc người khác', async () => {
    mockFindOne.mockResolvedValue(null)
    mockExists.mockResolvedValue({ _id: LECTURE_ID })

    await expect(getLecture(USER_ID, LECTURE_ID)).rejects.toMatchObject({
      statusCode: 403,
      message: 'Bạn không có quyền truy cập bài giảng này'
    })
  })

  it('trả 404 khi bài giảng không tồn tại', async () => {
    mockFindOne.mockResolvedValue(null)
    mockExists.mockResolvedValue(null)

    await expect(getLecture(USER_ID, LECTURE_ID)).rejects.toMatchObject({
      statusCode: 404
    })
  })
})
