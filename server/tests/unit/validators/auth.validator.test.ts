import {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema
} from '@/validators/auth.validator'

describe('auth.validator', () => {
  describe('registerSchema', () => {
    it('hợp lệ khi truyền đủ name, email, password đúng chuẩn', () => {
      const result = registerSchema.safeParse({
        name: 'Nguyen Van A',
        email: 'user@example.com',
        password: 'password123'
      })
      expect(result.success).toBe(true)
    })

    it('báo lỗi khi email sai định dạng', () => {
      const result = registerSchema.safeParse({
        name: 'Nguyen Van A',
        email: 'not-an-email',
        password: 'password123'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('đúng định dạng')
      }
    })

    it('báo lỗi khi password ngắn hơn 6 ký tự', () => {
      const result = registerSchema.safeParse({
        name: 'Nguyen Van A',
        email: 'user@example.com',
        password: '123'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('loginSchema', () => {
    it('hợp lệ khi email và password đúng format', () => {
      const result = loginSchema.safeParse({
        email: 'admin@example.com',
        password: 'admin_password'
      })
      expect(result.success).toBe(true)
    })

    it('thất bại khi thiếu password', () => {
      const result = loginSchema.safeParse({
        email: 'admin@example.com'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('refreshSchema', () => {
    it('hợp lệ khi refreshToken không rỗng', () => {
      const result = refreshSchema.safeParse({
        refreshToken: 'valid-refresh-token'
      })
      expect(result.success).toBe(true)
    })

    it('thất bại khi refreshToken rỗng', () => {
      const result = refreshSchema.safeParse({
        refreshToken: ''
      })
      expect(result.success).toBe(false)
    })
  })

  describe('changePasswordSchema', () => {
    it('thành công khi newPassword và confirmPassword trùng nhau', () => {
      const result = changePasswordSchema.safeParse({
        oldPassword: 'oldpassword123',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123'
      })
      expect(result.success).toBe(true)
    })

    it('thất bại khi confirmPassword không khớp', () => {
      const result = changePasswordSchema.safeParse({
        oldPassword: 'oldpassword123',
        newPassword: 'newpassword123',
        confirmPassword: 'differentpassword'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe(
          'Mật khẩu xác nhận không khớp'
        )
      }
    })
  })
})
