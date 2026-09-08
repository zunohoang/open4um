import { z } from 'zod'

export const createUserSchema = z.object({
  name: z
    .string({ message: 'Tên không được để trống' })
    .trim()
    .min(1, 'Tên không được để trống')
    .max(100, 'Tên không được vượt quá 100 ký tự'),
  email: z
    .string({ message: 'Email không được để trống' })
    .trim()
    .email('Email không đúng định dạng'),
  password: z
    .string({ message: 'Mật khẩu không được để trống' })
    .min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  creditBalance: z.coerce
    .number({ message: 'Số dư credit phải là số hợp lệ' })
    .min(0, 'Số dư credit không được âm')
    .optional()
})

export const updateUserSchema = z.object({
  creditBalance: z.coerce
    .number({ message: 'Số dư credit phải là số hợp lệ' })
    .min(0, 'Số dư credit không được âm')
})

export const updateCreditConfigSchema = z.object({
  pricePerSlide: z.coerce
    .number({ message: 'Giá mỗi slide phải là số' })
    .int('Giá mỗi slide phải là số nguyên')
    .positive('Giá mỗi slide phải lớn hơn 0')
    .optional(),
  pricePerAiEdit: z.coerce
    .number({ message: 'Giá chỉnh sửa AI phải là số' })
    .int('Giá chỉnh sửa AI phải là số nguyên')
    .positive('Giá chỉnh sửa AI phải lớn hơn 0')
    .optional(),
  signupBonus: z.coerce
    .number({ message: 'Thưởng đăng ký phải là số' })
    .int('Thưởng đăng ký phải là số nguyên')
    .positive('Thưởng đăng ký phải lớn hơn 0')
    .optional()
})
