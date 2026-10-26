const mockFindOneAndUpdate = jest.fn()
const mockUpdateOne = jest.fn()

jest.mock('@/models/user.model', () => ({
  UserModel: {
    findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args),
    updateOne: (...args: unknown[]) => mockUpdateOne(...args)
  }
}))

import { debitCredits, refundCredits } from '@/services/credit.service'

describe('credit.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('trừ credit bằng một thao tác nguyên tử và trả về số dư mới', async () => {
    mockFindOneAndUpdate.mockResolvedValue({ creditBalance: 20 })

    await expect(debitCredits('user-1', 80, 'Không đủ credit')).resolves.toBe(
      20
    )
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'user-1', creditBalance: { $gte: 80 } },
      { $inc: { creditBalance: -80 } },
      { new: true }
    )
  })

  it('từ chối mà không tạo số dư âm khi điều kiện số dư không còn đúng', async () => {
    mockFindOneAndUpdate.mockResolvedValue(null)

    await expect(
      debitCredits('user-1', 80, 'Không đủ credit')
    ).rejects.toMatchObject({ statusCode: 402, message: 'Không đủ credit' })
  })

  it('hoàn credit bằng phép cộng nguyên tử khi bước lưu kết quả thất bại', async () => {
    mockUpdateOne.mockResolvedValue({ modifiedCount: 1 })

    await refundCredits('user-1', 5)

    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: 'user-1' },
      { $inc: { creditBalance: 5 } }
    )
  })
})
