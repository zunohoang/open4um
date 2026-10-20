import { updateCreditConfigSchema } from '@/validators/admin.validator'

describe('admin.validator - updateCreditConfigSchema', () => {
  it('chấp nhận các mức credit là số nguyên dương', () => {
    const result = updateCreditConfigSchema.safeParse({
      pricePerLecture: 80,
      pricePerOutline: 3,
      pricePerSlide: 5,
      pricePerAiEdit: 2,
      signupBonus: 100
    })

    expect(result.success).toBe(true)
  })

  it.each([
    ['bằng 0', 0],
    ['số âm', -1],
    ['số thập phân', 1.5],
    ['chuỗi số', '2'],
    ['ký tự', 'abc'],
    ['rỗng', '']
  ])('từ chối giá trị %s', (_caseName, value) => {
    const result = updateCreditConfigSchema.safeParse({
      pricePerAiEdit: value
    })

    expect(result.success).toBe(false)
  })

  it('từ chối payload rỗng hoặc chứa trường không hỗ trợ', () => {
    expect(updateCreditConfigSchema.safeParse({}).success).toBe(false)
    expect(
      updateCreditConfigSchema.safeParse({ unknownCreditType: 2 }).success
    ).toBe(false)
  })
})
