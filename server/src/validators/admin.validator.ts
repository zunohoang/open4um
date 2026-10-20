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

const positiveCreditValue = (label: string) =>
  z
    .number({
      required_error: `${label} không được để trống`,
      invalid_type_error: `${label} phải là số nguyên dương`
    })
    .int(`${label} phải là số nguyên`)
    .positive(`${label} phải lớn hơn 0`)
    .max(Number.MAX_SAFE_INTEGER, `${label} vượt quá giới hạn cho phép`)

export const updateCreditConfigSchema = z
  .object({
    pricePerLecture: positiveCreditValue('Giá sinh bài giảng').optional(),
    pricePerSlide: positiveCreditValue('Giá mỗi slide').optional(),
    pricePerAiEdit: positiveCreditValue('Giá chỉnh sửa AI').optional(),
    pricePerOutline: positiveCreditValue('Giá sinh dàn ý').optional(),
    signupBonus: positiveCreditValue('Credit tặng khi đăng ký').optional()
  })
  .strict('Dữ liệu cấu hình chứa trường không hợp lệ')
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Cần cung cấp ít nhất một mức credit để cập nhật'
  })
