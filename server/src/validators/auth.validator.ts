import { z } from 'zod'

export const sendRegisterOtpSchema = z.object({
  email: z.string().email('Địa chỉ email không đúng định dạng')
})

export const registerSchema = z.object({
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự'),
  email: z.string().email('Địa chỉ email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  otp: z
    .string()
    .regex(/^\d{6}$/, 'Mã OTP phải gồm 6 chữ số')
    .optional()
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Địa chỉ email không đúng định dạng')
})

export const resetPasswordSchema = z.object({
  email: z.string().email('Địa chỉ email không đúng định dạng'),
  otp: z.string().regex(/^\d{6}$/, 'Mã OTP phải gồm 6 chữ số'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự')
})

export const loginSchema = z.object({
  email: z.string().email('Địa chỉ email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự')
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token không được để trống')
})

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự').optional()
})

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Vui lòng nhập mật khẩu cũ'),
    newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới')
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword']
  })
