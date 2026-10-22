import {
  createUserSchema,
  updateCreditConfigSchema,
  updateUserSchema
} from '@/validators/admin.validator'

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

describe('admin.validator - updateUserSchema', () => {
  it.each([
    ['họ tên', { name: 'Nguyễn Văn A' }],
    ['email', { email: 'a@example.com' }],
    ['credit bằng 0', { creditBalance: 0 }],
    ['cả ba trường', { name: 'B', email: 'b@example.com', creditBalance: 50 }]
  ])('chấp nhận cập nhật %s', (_caseName, payload) => {
    expect(updateUserSchema.safeParse(payload).success).toBe(true)
  })

  it.each([
    ['rỗng', {}],
    ['chứa trường không được sửa', { role: 'admin' }],
    ['email sai định dạng', { email: 'abc' }],
    ['họ tên rỗng', { name: '   ' }],
    ['credit âm', { creditBalance: -1 }],
    ['credit thập phân', { creditBalance: 1.5 }],
    ['credit null', { creditBalance: null }],
    ['credit dạng chuỗi', { creditBalance: '50' }]
  ])('từ chối payload %s', (_caseName, payload) => {
    expect(updateUserSchema.safeParse(payload).success).toBe(false)
  })
})

describe('admin.validator - createUserSchema', () => {
  const validUser = {
    name: 'Nguyễn Văn A',
    email: 'a@example.com',
    password: 'password123'
  }

  it('chấp nhận khi không gửi credit ban đầu', () => {
    expect(createUserSchema.safeParse(validUser).success).toBe(true)
  })

  it.each([
    ['null', null],
    ['chuỗi rỗng', ''],
    ['thập phân', 1.5]
  ])('từ chối credit ban đầu %s', (_caseName, creditBalance) => {
    expect(
      createUserSchema.safeParse({ ...validUser, creditBalance }).success
    ).toBe(false)
  })
})
