import { AppError } from '@/utils/AppError'
import { logger } from '@/lib/logger'
import { LectureModel } from '@/models/lecture.model'
import { AiUsageLogModel } from '@/models/aiUsageLog.model'
import { UserModel } from '@/models/user.model'
import { getCreditConfig } from '@/services/admin.service'
import { FolderModel } from '@/models/folder.model'
import { minioClient, BUCKET_MEDIA } from '@/lib/minio'
import {
  generateOutlineFromPrompt,
  buildSlidesFromOutline,
  editSlideWithInstruction,
  type GeneratedOutline
} from '@/services/ai.service'

interface ListParams {
  userId: string
  folderId?: string
  search?: string
  sortBy?: 'updatedAt' | 'createdAt' | 'title'
  sortOrder?: 'asc' | 'desc'
  page: number
  limit: number
}

export const generateOutline = async (userId: string, prompt: string) => {
  // Bước 1: Gọi AI để sinh outline TRƯỜC — nếu AI lỗi, không trừ credit
  const outline = await generateOutlineFromPrompt(prompt)
  if (!outline.sections.length)
    throw new AppError('AI không sinh được nội dung cho prompt này', 422)

  // Bước 2: Kiểm tra credit SAU khi biết số slide thực tế
  const config = await getCreditConfig()
  const creditSpent = outline.sections.length * config.pricePerSlide

  const user = await UserModel.findById(userId)
  if (!user) throw new AppError('Tài khoản không tồn tại', 404)
  if (user.creditBalance < creditSpent)
    throw new AppError('Không đủ credit để tạo bài giảng', 402)

  // Bước 3: Trừ credit và ghi log SAU KHI AI thành công
  user.creditBalance -= creditSpent
  await user.save()
  await AiUsageLogModel.create({
    userId,
    prompt,
    slideCount: outline.sections.length,
    creditSpent
  })

  return { outline, creditSpent, creditBalance: user.creditBalance }
}

export const createLecture = async (
  userId: string,
  data: {
    title: string
    prompt?: string
    pattern: string
    folderId?: string | null
    outline: GeneratedOutline
  }
) => {
  const slides = buildSlidesFromOutline(data.outline, data.pattern)
  return LectureModel.create({
    userId,
    title: data.title,
    prompt: data.prompt ?? '',
    pattern: data.pattern,
    slides,
    folderId: data.folderId ?? null
  })
}

export const createBlankLecture = async (
  userId: string,
  title: string,
  folderId?: string | null
) => {
  if (folderId) {
    const folder = await FolderModel.findOne({ _id: folderId, userId })
    if (!folder) throw new AppError('Không tìm thấy thư mục', 404)
  }
  return LectureModel.create({
    userId,
    title,
    folderId: folderId ?? null,
    slides: [
      {
        id: `slide-${crypto.randomUUID()}`,
        pattern: 'default',
        title: '',
        bullets: []
      }
    ]
  })
}

export const listLectures = async ({
  userId,
  folderId,
  search,
  sortBy = 'updatedAt',
  sortOrder = 'desc',
  page,
  limit
}: ListParams) => {
  const filter: Record<string, unknown> = { userId, deletedAt: null }
  if (folderId) {
    if (
      folderId === 'unorganized' ||
      folderId === 'null' ||
      folderId === 'none'
    ) {
      filter.folderId = null
    } else {
      filter.folderId = folderId
    }
  }
  if (search) filter.title = { $regex: search, $options: 'i' }
  const sortDirection = sortOrder === 'asc' ? 1 : -1
  const sort: Record<string, 1 | -1> = { [sortBy]: sortDirection, _id: -1 }

  const [items, total] = await Promise.all([
    LectureModel.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    LectureModel.countDocuments(filter)
  ])
  return { items, total }
}

export const listTrash = async (userId: string) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  return LectureModel.find({
    userId,
    deletedAt: { $ne: null, $gte: thirtyDaysAgo }
  }).sort({
    deletedAt: -1
  })
}

export const cleanupExpiredTrash = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const result = await LectureModel.deleteMany({
    deletedAt: { $ne: null, $lt: thirtyDaysAgo }
  })
  if (result.deletedCount > 0) {
    logger.info(
      `🧹 [CronJob] Đã xóa vĩnh viễn ${result.deletedCount} bài giảng trong thùng rác quá 30 ngày`
    )
  }
  return result.deletedCount
}

const findOwnedLecture = async (userId: string, id: string) => {
  const lecture = await LectureModel.findOne({ _id: id, userId })
  if (!lecture) throw new AppError('Không tìm thấy bài giảng', 404)
  return lecture
}

export const getLecture = async (userId: string, id: string) => {
  const lecture = await findOwnedLecture(userId, id)
  if (lecture.deletedAt) throw new AppError('Bài giảng đã bị xóa', 404)
  return lecture
}

export const updateLecture = async (
  userId: string,
  id: string,
  data: {
    title?: string
    pattern?: string
    slides?: unknown[]
    folderId?: string | null
  }
) => {
  const lecture = await findOwnedLecture(userId, id)

  if (data.folderId) {
    const folder = await FolderModel.findOne({ _id: data.folderId, userId })
    if (!folder) throw new AppError('Không tìm thấy thư mục', 404)
  }

  if (data.title !== undefined) lecture.set('title', data.title)
  if (data.pattern !== undefined) lecture.set('pattern', data.pattern)
  if (data.slides !== undefined) lecture.set('slides', data.slides)
  if (data.folderId !== undefined) lecture.set('folderId', data.folderId)

  await lecture.save()
  return lecture
}

export const duplicateLecture = async (userId: string, id: string) => {
  const source = await getLecture(userId, id)
  const slides = JSON.parse(JSON.stringify(source.slides)) as Array<
    Record<string, unknown>
  >
  const clonedSlides = slides.map((slide) => ({
    ...slide,
    id: `slide-${crypto.randomUUID()}`
  }))
  return LectureModel.create({
    userId,
    folderId: source.folderId,
    title: `${source.title} - Copy`,
    prompt: source.prompt,
    pattern: source.pattern,
    slides: clonedSlides
  })
}

export const applySlideOperation = async (
  userId: string,
  id: string,
  operation: {
    operation: 'add' | 'delete' | 'duplicate' | 'move' | 'update'
    slideId?: string
    index?: number
    toIndex?: number
    patch?: Record<string, unknown>
  }
) => {
  const lecture = await getLecture(userId, id)
  const slides = JSON.parse(JSON.stringify(lecture.slides)) as Array<
    Record<string, unknown>
  >
  const sourceIndex = operation.slideId
    ? slides.findIndex((slide) => slide.id === operation.slideId)
    : -1

  if (operation.operation !== 'add' && sourceIndex < 0)
    throw new AppError('Không tìm thấy slide', 404)
  if (operation.operation === 'delete' && slides.length === 1)
    throw new AppError('Bài giảng phải có ít nhất một slide', 400)

  if (operation.operation === 'add') {
    const index = Math.min(operation.index ?? slides.length, slides.length)
    slides.splice(index, 0, {
      id: `slide-${crypto.randomUUID()}`,
      pattern: lecture.pattern,
      title: '',
      bullets: []
    })
  } else if (operation.operation === 'delete') {
    slides.splice(sourceIndex, 1)
  } else if (operation.operation === 'duplicate') {
    const clone = { ...slides[sourceIndex], id: `slide-${crypto.randomUUID()}` }
    slides.splice(sourceIndex + 1, 0, clone)
  } else if (operation.operation === 'update') {
    slides[sourceIndex] = {
      ...slides[sourceIndex],
      ...(operation.patch ?? {})
    }
  } else {
    const [slide] = slides.splice(sourceIndex, 1)
    const targetIndex = Math.min(
      operation.toIndex ?? sourceIndex,
      slides.length
    )
    slides.splice(targetIndex, 0, slide)
  }

  lecture.set('slides', slides)
  await lecture.save()
  return lecture
}

export const deleteLecture = async (userId: string, id: string) => {
  const lecture = await findOwnedLecture(userId, id)
  lecture.set('deletedAt', new Date())
  await lecture.save()
  return {
    message:
      'Đã chuyển vào thùng rác. Tự động xóa vĩnh viễn sau 30 ngày đếm ngược.',
    deletedAt: lecture.deletedAt
  }
}

export const restoreLecture = async (userId: string, id: string) => {
  const lecture = await findOwnedLecture(userId, id)
  lecture.set('deletedAt', null)
  await lecture.save()
  return lecture
}

export const editSlideWithAi = async (
  userId: string,
  id: string,
  slideId: string,
  instruction: string
) => {
  const lecture = await findOwnedLecture(userId, id)
  if (lecture.deletedAt) throw new AppError('Bài giảng đã bị xóa', 404)

  const slideIndex = lecture.slides.findIndex(
    (slide) =>
      typeof slide === 'object' &&
      slide !== null &&
      (slide as { id?: unknown }).id === slideId
  )
  if (slideIndex < 0) throw new AppError('Không tìm thấy slide', 404)

  const config = await getCreditConfig()
  const user = await UserModel.findById(userId)
  if (!user) throw new AppError('Tài khoản không tồn tại', 404)
  if (user.creditBalance < config.pricePerAiEdit)
    throw new AppError('Không đủ credit để chỉnh sửa slide bằng AI', 402)

  const currentSlide = lecture.slides[slideIndex]
  if (typeof currentSlide !== 'object' || currentSlide === null)
    throw new AppError('Dữ liệu slide không hợp lệ', 422)
  const editedSlide = await editSlideWithInstruction(
    currentSlide as Record<string, unknown>,
    instruction
  )

  user.creditBalance -= config.pricePerAiEdit
  lecture.slides[slideIndex] = editedSlide
  await Promise.all([
    user.save(),
    lecture.save(),
    AiUsageLogModel.create({
      userId,
      prompt: instruction,
      slideCount: 1,
      creditSpent: config.pricePerAiEdit
    })
  ])

  return {
    lecture,
    slide: editedSlide,
    creditSpent: config.pricePerAiEdit,
    creditBalance: user.creditBalance
  }
}

export const exportLecture = async (userId: string, id: string) => {
  const lecture = await findOwnedLecture(userId, id)

  const exportBundle = {
    id: lecture._id,
    title: lecture.title,
    pattern: lecture.pattern,
    prompt: lecture.prompt,
    slideCount: lecture.slides.length,
    slides: lecture.slides,
    createdAt: lecture.createdAt,
    updatedAt: lecture.updatedAt,
    exportedAt: new Date().toISOString()
  }

  let downloadUrl: string | null = null

  try {
    const exists = await minioClient.bucketExists(BUCKET_MEDIA)
    if (!exists) {
      await minioClient.makeBucket(BUCKET_MEDIA)
    }

    const objectKey = `exports/${userId}/${lecture._id}-${Date.now()}.json`
    const content = Buffer.from(JSON.stringify(exportBundle, null, 2), 'utf-8')

    await minioClient.putObject(
      BUCKET_MEDIA,
      objectKey,
      content,
      content.length,
      {
        'Content-Type': 'application/json'
      }
    )

    downloadUrl = await minioClient.presignedGetObject(
      BUCKET_MEDIA,
      objectKey,
      24 * 60 * 60
    )
  } catch (err) {
    logger.warn(
      { err },
      'Không thể lưu tệp xuất lên MinIO, trả về dữ liệu xuất trực tiếp'
    )
  }

  return {
    message: 'Xuất bài giảng thành công',
    lectureId: lecture._id,
    title: lecture.title,
    downloadUrl,
    data: exportBundle
  }
}
