import { AppError } from '@/utils/AppError'
import { logger } from '@/lib/logger'
import { LectureModel } from '@/models/lecture.model'
import { AiUsageLogModel } from '@/models/aiUsageLog.model'
import { UserModel } from '@/models/user.model'
import { getCreditConfig } from '@/services/admin.service'
import { debitCredits, refundCredits } from '@/services/credit.service'
import { FolderModel } from '@/models/folder.model'
import { minioClient, minioPresignClient, BUCKET_MEDIA } from '@/lib/minio'
import { buildSlideComponents, THEME_PRESETS } from '@/constants/theme-options'
import { getAiReadableSlideContext } from '@/utils/aiChatContext'
import {
  generateOutlineFromPrompt,
  refineOutlineWithFeedback,
  generateSlidesFromOutline,
  editSlideWithInstruction,
  chatAndProposeSlideEdit,
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

export const generateOutline = async (
  userId: string,
  prompt: string,
  options?: {
    feedback?: string
    currentOutline?: GeneratedOutline
    lectureId?: string
  }
) => {
  const user = await UserModel.findById(userId)
  if (!user) throw new AppError('Tài khoản không tồn tại', 404)

  const config = await getCreditConfig()
  if (user.creditBalance < config.pricePerOutline) {
    throw new AppError('Không đủ credit để sinh dàn ý bài giảng', 402)
  }

  let outline: GeneratedOutline
  if (options?.feedback && options?.currentOutline) {
    outline = await refineOutlineWithFeedback(
      options.currentOutline,
      prompt,
      options.feedback
    )
  } else {
    outline = await generateOutlineFromPrompt(prompt)
  }

  if (!outline.sections?.length) {
    throw new AppError('AI không sinh được nội dung cho prompt này', 422)
  }

  const creditBalance = await debitCredits(
    userId,
    config.pricePerOutline,
    'Không đủ credit để sinh dàn ý bài giảng'
  )

  let lecture
  try {
    if (options?.lectureId) {
      lecture = await LectureModel.findOneAndUpdate(
        { _id: options.lectureId, userId },
        {
          title: outline.title || 'Bài giảng mới',
          prompt,
          outline
        },
        { new: true }
      )
    }

    if (!lecture) {
      lecture = await LectureModel.create({
        userId,
        title: outline.title || 'Bài giảng mới',
        prompt,
        outline,
        slides: []
      })
    }

    await AiUsageLogModel.create({
      userId,
      prompt: options?.feedback
        ? `${prompt} | Góp ý: ${options.feedback}`
        : prompt,
      slideCount: outline.sections.length,
      creditSpent: config.pricePerOutline
    })
  } catch (error) {
    await refundCredits(userId, config.pricePerOutline)
    throw error
  }

  return {
    lecture,
    outline,
    creditSpent: config.pricePerOutline,
    creditBalance
  }
}

export const createLecture = async (
  userId: string,
  data: {
    lectureId?: string
    title: string
    prompt?: string
    theme?: string
    folderId?: string | null
    outline: GeneratedOutline
  }
) => {
  const user = await UserModel.findById(userId)
  if (!user) throw new AppError('Tài khoản không tồn tại', 404)

  const config = await getCreditConfig()
  if (user.creditBalance < config.pricePerLecture) {
    throw new AppError(
      `Không đủ credit để tạo bài giảng. Cần ${config.pricePerLecture} credit.`,
      402
    )
  }

  const slides = await generateSlidesFromOutline(
    data.outline,
    data.prompt ?? ''
  )

  const creditSpent = config.pricePerLecture
  const creditBalance = await debitCredits(
    userId,
    creditSpent,
    `Không đủ credit để tạo bài giảng. Cần ${creditSpent} credit.`
  )

  const selectedTheme = data.theme || 'classic-editorial'
  const payload = {
    userId,
    title: data.title,
    prompt: data.prompt ?? '',
    theme: selectedTheme,
    outline: data.outline,
    slides: slides.map((s) => ({
      ...s,
      components: buildSlideComponents(s, selectedTheme)
    })),
    folderId: data.folderId ?? null
  }

  let lecture
  try {
    lecture = data.lectureId
      ? await LectureModel.findOneAndUpdate(
          { _id: data.lectureId, userId },
          payload,
          { new: true, upsert: true }
        )
      : await LectureModel.create(payload)
    await AiUsageLogModel.create({
      userId,
      prompt: data.prompt || data.title,
      slideCount: slides.length,
      creditSpent
    })
  } catch (error) {
    await refundCredits(userId, creditSpent)
    throw error
  }

  return {
    ...lecture.toObject(),
    creditSpent,
    creditBalance
  }
}

export const createBlankLecture = async (
  userId: string,
  title: string,
  theme?: string,
  folderId?: string | null
) => {
  let selectedTheme = 'classic-editorial'
  let targetFolderId = folderId ?? null

  if (folderId === undefined && theme) {
    if (THEME_PRESETS.some((t) => t.id === theme)) {
      selectedTheme = theme
    } else {
      targetFolderId = theme
    }
  } else if (theme) {
    selectedTheme = theme
  }

  if (targetFolderId) {
    const folder = await FolderModel.findOne({ _id: targetFolderId, userId })
    if (!folder) throw new AppError('Không tìm thấy thư mục', 404)
  }
  const blankSlide = {
    id: `slide-${crypto.randomUUID()}`,
    title: '',
    bullets: []
  }
  return LectureModel.create({
    userId,
    title,
    theme: selectedTheme,
    folderId: targetFolderId,
    slides: [
      {
        ...blankSlide,
        components: buildSlideComponents(blankSlide, selectedTheme)
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
    slides?: unknown[]
    theme?: string
    folderId?: string | null
    contextSummary?: string
    sourceMaterial?: string
    aiChatHistory?: unknown[]
  }
) => {
  const lecture = await findOwnedLecture(userId, id)

  if (data.folderId) {
    const folder = await FolderModel.findOne({ _id: data.folderId, userId })
    if (!folder) throw new AppError('Không tìm thấy thư mục', 404)
  }

  if (data.title !== undefined) lecture.set('title', data.title)
  if (data.slides !== undefined) lecture.set('slides', data.slides)
  if (data.theme !== undefined) lecture.set('theme', data.theme)
  if (data.folderId !== undefined) lecture.set('folderId', data.folderId)
  if (data.contextSummary !== undefined)
    lecture.set('contextSummary', data.contextSummary)
  if (data.sourceMaterial !== undefined)
    lecture.set('sourceMaterial', data.sourceMaterial)
  if (data.aiChatHistory !== undefined)
    lecture.set('aiChatHistory', data.aiChatHistory)

  await lecture.save()
  return lecture
}

export const duplicateLecture = async (userId: string, id: string) => {
  const source = await getLecture(userId, id)
  const slides = JSON.parse(JSON.stringify(source.slides)) as Array<
    Record<string, unknown>
  >
  const clonedSlides = slides.map((slide) => {
    const components = Array.isArray(slide.components)
      ? (slide.components as Array<Record<string, unknown>>).map((comp) => ({
          ...comp,
          id: `comp-${crypto.randomUUID()}`
        }))
      : slide.components
    return {
      ...slide,
      id: `slide-${crypto.randomUUID()}`,
      ...(components !== undefined ? { components } : {})
    }
  })
  return LectureModel.create({
    userId,
    folderId: source.folderId,
    title: `${source.title} - Copy`,
    prompt: source.prompt,
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
      title: '',
      bullets: []
    })
  } else if (operation.operation === 'delete') {
    slides.splice(sourceIndex, 1)
  } else if (operation.operation === 'duplicate') {
    const sourceSlide = slides[sourceIndex]
    const clonedComponents = Array.isArray(sourceSlide.components)
      ? (sourceSlide.components as Array<Record<string, unknown>>).map(
          (comp) => ({
            ...comp,
            id: `comp-${crypto.randomUUID()}`
          })
        )
      : sourceSlide.components

    const clone = {
      ...sourceSlide,
      id: `slide-${crypto.randomUUID()}`,
      ...(clonedComponents !== undefined
        ? { components: clonedComponents }
        : {})
    }
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

export const hardDeleteLecture = async (userId: string, id: string) => {
  const lecture = await findOwnedLecture(userId, id)
  await LectureModel.deleteOne({ _id: lecture._id, userId })
  return {
    message: 'Đã xóa vĩnh viễn bài giảng'
  }
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

  const creditBalance = await debitCredits(
    userId,
    config.pricePerAiEdit,
    'Không đủ credit để chỉnh sửa slide bằng AI'
  )
  try {
    lecture.slides[slideIndex] = editedSlide
    await lecture.save()
    await AiUsageLogModel.create({
      userId,
      prompt: instruction,
      slideCount: 1,
      creditSpent: config.pricePerAiEdit
    })
  } catch (error) {
    await refundCredits(userId, config.pricePerAiEdit)
    throw error
  }

  return {
    lecture,
    slide: editedSlide,
    creditSpent: config.pricePerAiEdit,
    creditBalance
  }
}

export const exportLecture = async (userId: string, id: string) => {
  const lecture = await findOwnedLecture(userId, id)

  const exportBundle = {
    id: lecture._id,
    title: lecture.title,
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

    downloadUrl = await minioPresignClient.presignedGetObject(
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

export const aiChatInEditor = async (
  userId: string,
  lectureId: string,
  payload: {
    message: string
    slideId?: string
    currentSlide?: Record<string, unknown>
    selectedCompId?: string
    sourceMaterial?: string
    history?: Array<{ role: 'user' | 'assistant'; text: string }>
  }
) => {
  const lecture = await findOwnedLecture(userId, lectureId)
  if (lecture.deletedAt) throw new AppError('Bài giảng đã bị xóa', 404)

  const config = await getCreditConfig()
  const user = await UserModel.findById(userId)
  if (!user) throw new AppError('Tài khoản không tồn tại', 404)
  const minimumAiCredit = Math.min(config.pricePerAiEdit, config.pricePerSlide)
  if (user.creditBalance < minimumAiCredit) {
    throw new AppError('Không đủ credit để sử dụng trợ lý AI', 402)
  }

  const slides = (lecture.slides || []) as Array<Record<string, unknown>>
  const targetSlideIndex = payload.slideId
    ? slides.findIndex((s) => s && s.id === payload.slideId)
    : 0

  const activeIndex = targetSlideIndex >= 0 ? targetSlideIndex : 0
  const persistedCurrentSlide = slides[activeIndex] || {}
  const hasMatchingSnapshot =
    payload.currentSlide &&
    String(payload.currentSlide.id || '') ===
      String(persistedCurrentSlide.id || '')
  const currentSlide = hasMatchingSnapshot
    ? payload.currentSlide!
    : persistedCurrentSlide
  const contextualSlides = slides.map((slide, index) =>
    index === activeIndex ? currentSlide : slide
  )
  const prevSlide =
    activeIndex > 0 ? contextualSlides[activeIndex - 1] : undefined
  const nextSlide =
    activeIndex < contextualSlides.length - 1
      ? contextualSlides[activeIndex + 1]
      : undefined

  let selectedElement: Record<string, unknown> | undefined
  if (payload.selectedCompId && Array.isArray(currentSlide.components)) {
    selectedElement = (
      currentSlide.components as Array<Record<string, unknown>>
    ).find((c) => c && c.id === payload.selectedCompId)
  }

  const outlineOverview = contextualSlides
    .map((slide, idx) => {
      const readableSlide = getAiReadableSlideContext(slide)
      return `Slide ${idx + 1}: ${readableSlide.title || 'Không có tiêu đề'}`
    })
    .join('\n')

  const slidesCatalog = contextualSlides.map((slide, idx) => {
    const readableSlide = getAiReadableSlideContext(slide)
    return {
      slideNumber: idx + 1,
      id: String(slide.id || `slide-${idx + 1}`),
      header: readableSlide.header,
      title: readableSlide.title || 'Không có tiêu đề',
      bullets: readableSlide.bullets,
      layout: String(slide.layout || slide.contentLayout || 'standard'),
      contentItems: readableSlide.contentItems,
      visibleText: readableSlide.visibleText
    }
  })

  let initialSummary = (lecture.get('contextSummary') as string) || ''
  if (!initialSummary && slidesCatalog.length > 0) {
    initialSummary =
      `Bài giảng "${lecture.title}" gồm ${slidesCatalog.length} slides: ` +
      slidesCatalog.map((s) => `Slide ${s.slideNumber}: ${s.title}`).join('; ')
  }

  if (payload.sourceMaterial !== undefined) {
    lecture.set('sourceMaterial', payload.sourceMaterial)
  }

  const aiResult = await chatAndProposeSlideEdit(payload.message, {
    presentationTitle: lecture.title,
    totalSlides: slides.length,
    currentSlideIndex: activeIndex,
    currentSlide,
    surroundingSlides: {
      prev: prevSlide,
      next: nextSlide
    },
    slidesCatalog,
    outlineOverview,
    contextSummary: initialSummary,
    selectedElement,
    sourceMaterial:
      payload.sourceMaterial || (lecture.get('sourceMaterial') as string) || '',
    history: payload.history,
    theme: (lecture.get('theme') as string) || undefined,
    creditBalance: user.creditBalance,
    pricePerSlide: config.pricePerSlide,
    maxCreatableSlides: Math.floor(user.creditBalance / config.pricePerSlide)
  })

  const rawProposals = aiResult.proposals || []
  const includesSlideUpdate =
    rawProposals.some((proposal) => proposal.action === 'UPDATE_SLIDE') ||
    aiResult.action === 'UPDATE_SLIDE' ||
    aiResult.action === 'UPDATE_CURRENT_SLIDE'
  const creditReservedForUpdate = includesSlideUpdate
    ? config.pricePerAiEdit
    : 0
  const maxAffordableCreates = Math.max(
    0,
    Math.floor(
      (user.creditBalance - creditReservedForUpdate) / config.pricePerSlide
    )
  )
  let acceptedCreateCount = 0
  const proposals = rawProposals.filter((proposal) => {
    if (proposal.action !== 'CREATE_SLIDE') return true
    if (acceptedCreateCount >= maxAffordableCreates) return false
    acceptedCreateCount += 1
    return true
  })

  if (proposals.length !== rawProposals.length) {
    aiResult.proposals = proposals
    aiResult.reply += ` Hệ thống chỉ giữ lại ${acceptedCreateCount} slide mới phù hợp với số credit hiện tại của bạn.`
  }

  const requestedCreateCount = rawProposals.filter(
    (proposal) => proposal.action === 'CREATE_SLIDE'
  ).length
  if (
    requestedCreateCount > 0 &&
    acceptedCreateCount === 0 &&
    !includesSlideUpdate
  ) {
    throw new AppError(
      `Không đủ credit để tạo slide mới. Cần ${config.pricePerSlide} credit.`,
      402
    )
  }

  if (
    aiResult.action === 'CREATE_SLIDE' &&
    aiResult.proposedSlide &&
    maxAffordableCreates < 1
  ) {
    throw new AppError(
      `Không đủ credit để tạo slide mới. Cần ${config.pricePerSlide} credit.`,
      402
    )
  }

  const createdSlideCount =
    proposals.length > 0
      ? proposals.filter((proposal) => proposal.action === 'CREATE_SLIDE')
          .length
      : aiResult.action === 'CREATE_SLIDE' && aiResult.proposedSlide
        ? 1
        : 0
  const creditSpent =
    createdSlideCount > 0
      ? createdSlideCount * config.pricePerSlide +
        (includesSlideUpdate ? config.pricePerAiEdit : 0)
      : config.pricePerAiEdit

  if (user.creditBalance < creditSpent) {
    throw new AppError(
      `Không đủ credit cho kết quả AI này. Cần ${creditSpent} credit.`,
      402
    )
  }

  const creditBalance = await debitCredits(
    userId,
    creditSpent,
    `Không đủ credit cho kết quả AI này. Cần ${creditSpent} credit.`
  )

  if (aiResult.updatedSummary) {
    lecture.set('contextSummary', aiResult.updatedSummary)
  }

  const targetIdx =
    typeof aiResult.targetSlideIndex === 'number' &&
    aiResult.targetSlideIndex >= 0 &&
    aiResult.targetSlideIndex < slides.length
      ? aiResult.targetSlideIndex
      : activeIndex

  let proposedSlide = aiResult.proposedSlide
  if (
    proposedSlide &&
    (aiResult.action === 'UPDATE_SLIDE' ||
      aiResult.action === 'UPDATE_CURRENT_SLIDE')
  ) {
    const baseSlide =
      targetIdx === activeIndex ? currentSlide : slides[targetIdx] || {}
    // Giữ nguyên ID của slide cũ để không mất liên kết, nhưng BẮT BUỘC dùng components mới do AI & Layout Engine vừa sinh ra
    // TUYỆT ĐỐI không ghi đè lại baseComps cũ vì sẽ làm sống lại lỗi đè chữ / layout cũ!
    proposedSlide = {
      ...baseSlide,
      ...proposedSlide,
      id: (baseSlide.id as string) || (proposedSlide.id as string),
      components: proposedSlide.components || baseSlide.components
    }
  }

  const now = new Date()
  const timeString = now.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  })

  const userMsg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'user',
    text: payload.message,
    timestamp: timeString
  }

  const assistantMsg = {
    id: `msg-${Date.now() + 1}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'assistant',
    text: aiResult.reply,
    action: aiResult.action,
    targetSlideIndex: targetIdx,
    proposedSlide,
    proposals: aiResult.proposals,
    status:
      proposedSlide || (aiResult.proposals && aiResult.proposals.length > 0)
        ? 'pending'
        : undefined,
    timestamp: timeString
  }

  const existingHistory =
    (lecture.get('aiChatHistory') as Array<Record<string, unknown>>) || []
  const updatedHistory = [...existingHistory, userMsg, assistantMsg]
  try {
    lecture.set('aiChatHistory', updatedHistory)
    await lecture.save()
    await AiUsageLogModel.create({
      userId,
      prompt: payload.message,
      slideCount: createdSlideCount || Math.max(1, proposals.length),
      creditSpent
    })
  } catch (error) {
    await refundCredits(userId, creditSpent)
    throw error
  }

  return {
    reply: aiResult.reply,
    action: aiResult.action,
    targetSlideIndex: targetIdx,
    proposedSlide,
    proposals: aiResult.proposals,
    aiChatHistory: updatedHistory,
    updatedSummary: aiResult.updatedSummary,
    creditSpent,
    creditBalance
  }
}
