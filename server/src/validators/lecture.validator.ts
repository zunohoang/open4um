import { z } from 'zod'

export const generateOutlineSchema = z.object({
  prompt: z.string().min(5, 'Yêu cầu prompt phải có ít nhất 5 ký tự')
})

const outlineSchema = z.object({
  title: z.string().min(1, 'Tiêu đề outline không được để trống'),
  sections: z.array(
    z.object({
      heading: z.string().min(1, 'Tiêu đề phần không được để trống'),
      bullets: z.array(z.string())
    })
  )
})

export const createLectureSchema = z.object({
  title: z.string().min(1, 'Tiêu đề bài giảng không được để trống'),
  prompt: z.string().optional(),
  pattern: z.string().min(1, 'Mẫu bài giảng không được để trống'),
  folderId: z.string().nullable().optional(),
  outline: outlineSchema
})

export const createBlankLectureSchema = z.object({
  title: z.string().min(1, 'Tiêu đề bài giảng không được để trống'),
  folderId: z.string().nullable().optional()
})

export const updateLectureSchema = z.object({
  title: z.string().min(1, 'Tiêu đề bài giảng không được để trống').optional(),
  pattern: z.string().optional(),
  slides: z.array(z.record(z.string(), z.unknown())).optional(),
  folderId: z.string().nullable().optional()
})

export const aiEditSlideSchema = z.object({
  slideId: z.string().min(1, 'Mã slide không được để trống'),
  instruction: z
    .string()
    .min(2, 'Hướng dẫn chỉnh sửa phải có ít nhất 2 ký tự')
    .max(2000, 'Hướng dẫn chỉnh sửa không được quá 2000 ký tự')
})

export const slideOperationSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('add'),
    index: z.number().int('Chỉ số slide phải là số nguyên').min(0).optional()
  }),
  z.object({
    operation: z.literal('delete'),
    slideId: z.string().min(1, 'Mã slide không được để trống')
  }),
  z.object({
    operation: z.literal('duplicate'),
    slideId: z.string().min(1, 'Mã slide không được để trống')
  }),
  z.object({
    operation: z.literal('move'),
    slideId: z.string().min(1, 'Mã slide không được để trống'),
    toIndex: z
      .number()
      .int('Vị trí chuyển đến phải là số nguyên')
      .min(0, 'Vị trí chuyển đến không được âm')
  }),
  z.object({
    operation: z.literal('update'),
    slideId: z.string().min(1, 'Mã slide không được để trống'),
    patch: z.record(z.string(), z.unknown())
  })
])
