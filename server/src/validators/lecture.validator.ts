import { z } from 'zod'

const outlineSchema = z.object({
  title: z.string().min(1, 'Tiêu đề outline không được để trống'),
  sections: z.array(
    z.object({
      heading: z.string().min(1, 'Tiêu đề phần không được để trống'),
      bullets: z.array(z.string())
    })
  )
})

export const generateOutlineSchema = z.object({
  prompt: z.string().min(5, 'Yêu cầu prompt phải có ít nhất 5 ký tự'),
  feedback: z.string().optional(),
  currentOutline: outlineSchema.optional(),
  lectureId: z.string().optional()
})

export const createLectureSchema = z.object({
  lectureId: z.string().optional(),
  title: z.string().min(1, 'Tiêu đề bài giảng không được để trống'),
  prompt: z.string().optional(),
  theme: z.string().optional(),
  folderId: z.string().nullable().optional(),
  outline: outlineSchema
})

export const createBlankLectureSchema = z.object({
  title: z.string().min(1, 'Tiêu đề bài giảng không được để trống'),
  theme: z.string().optional(),
  folderId: z.string().nullable().optional()
})

export const updateLectureSchema = z.object({
  title: z.string().min(1, 'Tiêu đề bài giảng không được để trống').optional(),
  slides: z.array(z.record(z.string(), z.unknown())).optional(),
  theme: z.string().optional(),
  folderId: z.string().nullable().optional(),
  contextSummary: z.string().optional(),
  sourceMaterial: z.string().optional(),
  aiChatHistory: z.array(z.record(z.string(), z.unknown())).optional()
})

export const aiEditSlideSchema = z.object({
  slideId: z.string().min(1, 'Mã slide không được để trống'),
  instruction: z
    .string()
    .min(2, 'Hướng dẫn chỉnh sửa phải có ít nhất 2 ký tự')
    .max(2000, 'Hướng dẫn chỉnh sửa không được quá 2000 ký tự')
})

const aiChatSlideSnapshotSchema = z
  .object({
    id: z.string().min(1).max(200),
    title: z.string().max(1000).optional(),
    subtitle: z.string().max(5000).optional(),
    header: z.string().max(1000).optional(),
    footer: z.string().max(1000).optional(),
    bullets: z.array(z.string().max(5000)).max(100).optional(),
    contentItems: z
      .array(z.record(z.string(), z.unknown()))
      .max(100)
      .optional(),
    components: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            type: z.enum([
              'title',
              'subtitle',
              'text',
              'bullets',
              'quote',
              'image',
              'shape'
            ]),
            content: z.string().max(10000)
          })
          .passthrough()
      )
      .max(300)
      .optional()
  })
  .passthrough()

export const aiChatSchema = z.object({
  message: z
    .string()
    .min(1, 'Nội dung tin nhắn không được để trống')
    .max(3000, 'Nội dung tin nhắn không được quá 3000 ký tự'),
  slideId: z.string().optional(),
  currentSlide: aiChatSlideSnapshotSchema.optional(),
  selectedCompId: z.string().optional(),
  sourceMaterial: z.string().max(10000).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string()
      })
    )
    .optional()
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
