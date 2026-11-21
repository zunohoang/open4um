import { AppError } from '@/utils/AppError'
import { externalizeImages } from '@/utils/lectureImages'
import {
  requestContext,
  updateAiTask
} from '@/middlewares/requestContext.middleware'
import { logger } from '@/lib/logger'
import { LectureModel, type LectureDocument } from '@/models/lecture.model'
import { AiUsageLogModel } from '@/models/aiUsageLog.model'
import { UserModel } from '@/models/user.model'
import { getCreditConfig } from '@/services/admin.service'
import { debitCredits, refundCredits } from '@/services/credit.service'
import { FolderModel } from '@/models/folder.model'
import { buildSlideComponents, THEME_PRESETS } from '@/constants/theme-options'
import { getAiReadableSlideContext } from '@/utils/aiChatContext'
import { isValidObjectId, Types } from 'mongoose'
import {
  generateOutlineFromPrompt,
  refineOutlineWithFeedback,
  generateSlidesFromOutline,
  chatAndProposeSlideEdit,
  editSelectedText,
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
  summary?: boolean
}

const LECTURE_SUMMARY_PROJECTION = {
  _id: 1,
  userId: 1,
  folderId: 1,
  title: 1,
  theme: 1,
  deletedAt: 1,
  createdAt: 1,
  updatedAt: 1,
  previewSlide: { $arrayElemAt: [{ $ifNull: ['$slides', []] }, 0] },
  slideCount: { $size: { $ifNull: ['$slides', []] } }
}

const getRevisionFilter = (revision: number) =>
  revision === 0
    ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] }
    : { revision }

// Only undo a write that still belongs to this request. A later edit owns its revision.
async function undoAiWrite(
  written: LectureDocument,
  before: LectureDocument | null,
  fields: string[]
) {
  const identity = { _id: written._id, userId: written.userId, deletedAt: null }
  const guard = {
    ...identity,
    ...getRevisionFilter(written.revision ?? 0),
    updatedAt: written.updatedAt,
    [`aiChatHistory.${written.aiChatHistory?.length ?? 0}`]: { $exists: false }
  }
  if (!before) return (await LectureModel.deleteOne(guard)).deletedCount === 1
  const restore = Object.fromEntries(
    fields.map((key) => [key, before.get(key)])
  )
  const result = await LectureModel.updateOne(
    guard,
    {
      $set: {
        ...restore,
        revision: before.revision ?? 0,
        updatedAt: before.updatedAt
      }
    },
    { timestamps: false }
  )
  if (result.matchedCount) return true
  // A concurrent save advanced the document. Restore only fields still equal to our write.
  const results = await Promise.all(
    fields.map((key) => {
      if (key === 'aiChatHistory') {
        const appended = written.aiChatHistory
          .slice(before.aiChatHistory.length)
          .map((message) => message.id)
        return LectureModel.updateOne(
          identity,
          { $pull: { aiChatHistory: { id: { $in: appended } } } },
          { timestamps: false }
        )
      }
      return LectureModel.updateOne(
        { ...identity, [key]: { $eq: written.get(key) } },
        { $set: { [key]: before.get(key) } },
        { timestamps: false }
      )
    })
  )
  return results.every((result) => result.matchedCount === 1)
}

async function rollbackAi(
  userId: string,
  amount: number,
  usageId: unknown,
  written: LectureDocument | null | undefined,
  before: LectureDocument | null,
  fields: string[]
) {
  const result = await Promise.allSettled([
    refundCredits(userId, amount).then(() =>
      updateAiTask({ creditRefunded: amount })
    ),
    usageId
      ? AiUsageLogModel.deleteOne({ _id: usageId }).then(() =>
          updateAiTask({ usageLogId: null })
        )
      : undefined,
    written
      ? undoAiWrite(written, before, fields).then((lectureRestored) =>
          updateAiTask({ lectureRestored })
        )
      : undefined
  ])
  for (const entry of result) {
    if (entry.status === 'rejected') {
      logger.error(
        { err: entry.reason, lectureId: written?._id },
        'Không hoàn tất hoàn tác yêu cầu AI'
      )
      throw entry.reason
    }
  }
}

export const generateOutline = async (
  userId: string,
  prompt: string,
  options?: {
    feedback?: string
    currentOutline?: GeneratedOutline
    lectureId?: string
  },
  signal?: AbortSignal
) => {
  const existingLecture = options?.lectureId
    ? await getLecture(userId, options.lectureId)
    : null
  signal?.throwIfAborted()
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
      options.feedback,
      signal
    )
  } else {
    outline = await generateOutlineFromPrompt(prompt, signal)
  }

  if (!outline.sections?.length) {
    throw new AppError('AI không sinh được nội dung cho prompt này', 422)
  }

  signal?.throwIfAborted()
  const creditBalance = await debitCredits(
    userId,
    config.pricePerOutline,
    'Không đủ credit để sinh dàn ý bài giảng'
  )

  updateAiTask({ creditDebited: config.pricePerOutline })
  let lecture: LectureDocument | null | undefined
  let usageId: unknown
  const undoWrite = () =>
    rollbackAi(
      userId,
      config.pricePerOutline,
      usageId,
      lecture,
      existingLecture,
      ['prompt', 'outline']
    )
  try {
    signal?.throwIfAborted()
    if (options?.lectureId) {
      lecture = await LectureModel.findOneAndUpdate(
        {
          _id: options.lectureId,
          userId,
          deletedAt: null,
          ...getRevisionFilter(existingLecture?.revision ?? 0)
        },
        // Giữ tên người dùng đã nhập ở bước tạo bài giảng (UC021)
        {
          $set: {
            prompt,
            outline
          },
          $inc: { revision: 1 }
        },
        { new: true }
      )
    }

    if (options?.lectureId && !lecture) {
      await getLecture(userId, options.lectureId)
      throw new AppError(
        'Bài giảng đã thay đổi trong lúc AI xử lý. Vui lòng tải lại trước khi tạo dàn ý.',
        409
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

    updateAiTask({ lectureId: String(lecture._id) })
    const usage = await AiUsageLogModel.create({
      userId,
      prompt: options?.feedback
        ? `${prompt} | Góp ý: ${options.feedback}`
        : prompt,
      slideCount: 0,
      creditSpent: config.pricePerOutline
    })
    usageId = usage._id
    updateAiTask({ usageLogId: String(usageId) })
    signal?.throwIfAborted()
  } catch (error) {
    await undoWrite()
    throw error
  }

  const context = requestContext.getStore()
  if (context) context.undoUndelivered = undoWrite

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
  },
  signal?: AbortSignal
) => {
  const existingLecture = data.lectureId
    ? await getLecture(userId, data.lectureId)
    : null
  const folderId = data.folderId ?? existingLecture?.folderId ?? null
  if (folderId && !(await FolderModel.exists({ _id: folderId, userId })))
    throw new AppError('Không tìm thấy thư mục', 404)
  signal?.throwIfAborted()
  const user = await UserModel.findById(userId)
  if (!user) throw new AppError('Tài khoản không tồn tại', 404)

  // SRS UC032: giá tính theo từng slide được sinh ra (VD: tạo mới 1 slide = N credit)
  const config = await getCreditConfig()
  const estimatedCredit = config.pricePerSlide * data.outline.sections.length
  if (user.creditBalance < estimatedCredit) {
    throw new AppError(
      `Không đủ credit để tạo bài giảng. Cần ${estimatedCredit} credit.`,
      402
    )
  }

  const slides = await generateSlidesFromOutline(
    data.outline,
    data.prompt ?? '',
    signal
  )

  const creditSpent = config.pricePerSlide * slides.length
  signal?.throwIfAborted()
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
    folderId
  }

  signal?.throwIfAborted()
  const creditBalance = await debitCredits(
    userId,
    creditSpent,
    `Không đủ credit để tạo bài giảng. Cần ${creditSpent} credit.`
  )
  updateAiTask({ creditDebited: creditSpent })
  let lecture: LectureDocument | null | undefined
  let usageId: unknown
  const undoWrite = () =>
    rollbackAi(userId, creditSpent, usageId, lecture, existingLecture, [
      'title',
      'prompt',
      'theme',
      'outline',
      'slides',
      'folderId'
    ])
  try {
    signal?.throwIfAborted()
    lecture = data.lectureId
      ? await LectureModel.findOneAndUpdate(
          {
            _id: data.lectureId,
            userId,
            deletedAt: null,
            ...getRevisionFilter(existingLecture?.revision ?? 0)
          },
          { $set: payload, $inc: { revision: 1 } },
          { new: true }
        )
      : await LectureModel.create(payload)
    if (!lecture) {
      if (data.lectureId) await getLecture(userId, data.lectureId)
      throw new AppError(
        'Bài giảng đã thay đổi trong lúc AI xử lý. Vui lòng tải lại trước khi tạo lại bài giảng.',
        409
      )
    }
    updateAiTask({ lectureId: String(lecture._id) })
    const usage = await AiUsageLogModel.create({
      userId,
      prompt: data.prompt || data.title,
      slideCount: slides.length,
      creditSpent
    })
    usageId = usage._id
    updateAiTask({ usageLogId: String(usageId) })
    signal?.throwIfAborted()
  } catch (error) {
    await undoWrite()
    throw error
  }

  const context = requestContext.getStore()
  if (context) context.undoUndelivered = undoWrite

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
  const selectedTheme =
    theme && THEME_PRESETS.some((t) => t.id === theme)
      ? theme
      : 'classic-editorial'
  const targetFolderId = folderId ?? null

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
  limit,
  summary = false
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
  if (search?.trim())
    filter.title = {
      $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      $options: 'i'
    }
  const sortDirection = sortOrder === 'asc' ? 1 : -1
  const sort: Record<string, 1 | -1> = { [sortBy]: sortDirection, _id: -1 }

  const query = LectureModel.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
  if (sortBy === 'title')
    query.collation({ locale: 'vi', strength: 2, numericOrdering: true })
  if (summary) query.select(LECTURE_SUMMARY_PROJECTION).lean()

  const [items, total] = await Promise.all([
    query,
    LectureModel.countDocuments(filter)
  ])
  return { items, total }
}

export const getLectureCounts = async (userId: string) => {
  const groups = await LectureModel.aggregate<{
    _id: Types.ObjectId | null
    count: number
  }>([
    { $match: { userId: new Types.ObjectId(userId), deletedAt: null } },
    { $group: { _id: '$folderId', count: { $sum: 1 } } }
  ])
  const folders: Record<string, number> = {}
  let total = 0
  let unorganized = 0
  for (const group of groups) {
    total += group.count
    if (group._id) folders[String(group._id)] = group.count
    else unorganized += group.count
  }
  return { total, unorganized, folders }
}

export const listTrash = async (userId: string, summary = false) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const query = LectureModel.find({
    userId,
    deletedAt: { $ne: null, $gte: thirtyDaysAgo }
  }).sort({
    deletedAt: -1
  })
  if (summary) query.select(LECTURE_SUMMARY_PROJECTION).lean()
  return query
}

const findOwnedLecture = async (userId: string, id: string) => {
  if (!isValidObjectId(id)) throw new AppError('Mã bài giảng không hợp lệ', 400)
  const lecture = await LectureModel.findOne({ _id: id, userId })
  if (lecture) return lecture
  // SRS UC009 2a: bài giảng tồn tại nhưng của người khác -> báo không có quyền
  if (await LectureModel.exists({ _id: id }))
    throw new AppError('Bạn không có quyền truy cập bài giảng này', 403)
  throw new AppError('Không tìm thấy bài giảng', 404)
}

export { uploadImage, getImage } from '@/lib/storage'

export const getLecture = async (userId: string, id: string) => {
  const lecture = await findOwnedLecture(userId, id)
  if (lecture.deletedAt) throw new AppError('Bài giảng đã bị xóa', 404)
  return lecture
}

export const updateLecture = async (
  userId: string,
  id: string,
  data: {
    revision?: number
    title?: string
    slides?: unknown[]
    theme?: string
    folderId?: string | null
    contextSummary?: string
    sourceMaterial?: string
    aiChatHistory?: unknown[]
  }
) => {
  const lecture = await getLecture(userId, id)

  if (data.folderId) {
    const folder = await FolderModel.findOne({ _id: data.folderId, userId })
    if (!folder) throw new AppError('Không tìm thấy thư mục', 404)
  }

  const { revision, ...changes } = data
  if (changes.slides || changes.aiChatHistory)
    await externalizeImages(userId, [changes.slides, changes.aiChatHistory])
  const filter: Record<string, unknown> = {
    _id: lecture._id,
    userId,
    deletedAt: null
  }
  if (revision !== undefined) {
    // Những bài giảng cũ chưa có revision được coi là phiên bản 0.
    filter.$or =
      revision === 0
        ? [{ revision: 0 }, { revision: { $exists: false } }]
        : [{ revision }]
  }
  const updated = await LectureModel.findOneAndUpdate(
    filter,
    { $set: changes, $inc: { revision: 1 } },
    { new: true, runValidators: true }
  )
  if (!updated) {
    await getLecture(userId, id)
    throw new AppError(
      'Bài giảng đã thay đổi ở nơi khác. Bản chỉnh sửa của bạn được giữ lại; hãy tải lại bài giảng trước khi tiếp tục lưu.',
      409
    )
  }
  return updated
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
    // SRS UC025: bản sao "y hệt" bản gốc, gồm cả giao diện và dàn ý
    theme: source.theme,
    outline: source.outline,
    contextSummary: source.contextSummary,
    sourceMaterial: source.sourceMaterial,
    slides: clonedSlides
  })
}

export const deleteLecture = async (userId: string, id: string) => {
  const lecture = await findOwnedLecture(userId, id)
  // Lặp lại yêu cầu xóa không được khởi động lại thời hạn giữ trong thùng rác.
  await LectureModel.updateOne(
    { _id: lecture._id, userId, deletedAt: null },
    { $set: { deletedAt: new Date() } }
  )
  const trashed = await findOwnedLecture(userId, id)
  return {
    message:
      'Đã chuyển vào thùng rác. Tự động xóa vĩnh viễn sau 30 ngày đếm ngược.',
    deletedAt: trashed.deletedAt
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

export const aiChatInEditor = async (
  userId: string,
  lectureId: string,
  payload: {
    message: string
    slideId?: string
    currentSlide?: Record<string, unknown>
    selectedCompId?: string
    textEdit?: {
      action: 'rewrite' | 'shorten' | 'expand'
      start: number
      end: number
    }
    sourceMaterial?: string
    history?: Array<{ role: 'user' | 'assistant'; text: string }>
  },
  signal?: AbortSignal
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

  const range = payload.textEdit
  const content = selectedElement?.content
  if (
    range &&
    (!hasMatchingSnapshot ||
      typeof content !== 'string' ||
      selectedElement?.type === 'shape' ||
      selectedElement?.type === 'image' ||
      range.start < 0 ||
      range.start >= range.end ||
      range.end > content.length ||
      !content.slice(range.start, range.end).trim())
  ) {
    throw new AppError('Vui lòng chọn lại đoạn văn bản cần sửa.', 422)
  }
  const aiResult =
    range && typeof content === 'string'
      ? await editSelectedText(
          range.action,
          content.slice(range.start, range.end),
          signal
        )
      : await chatAndProposeSlideEdit(
          payload.message,
          {
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
              payload.sourceMaterial ??
              (lecture.get('sourceMaterial') as string) ??
              '',
            history: payload.history,
            theme: (lecture.get('theme') as string) || undefined,
            creditBalance: user.creditBalance,
            pricePerSlide: config.pricePerSlide,
            maxCreatableSlides: Math.floor(
              user.creditBalance / config.pricePerSlide
            )
          },
          signal
        )

  if (
    range &&
    typeof content === 'string' &&
    aiResult.replacement &&
    content.length - (range.end - range.start) + aiResult.replacement.length >
      10000
  )
    throw new AppError('Văn bản sau khi sửa vượt quá 10.000 ký tự.', 422)

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
      : includesSlideUpdate
        ? config.pricePerAiEdit
        : 0 // chỉ trả lời chat, không thay đổi slide -> không trừ credit

  if (user.creditBalance < creditSpent) {
    throw new AppError(
      `Không đủ credit cho kết quả AI này. Cần ${creditSpent} credit.`,
      402
    )
  }

  signal?.throwIfAborted()

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
  signal?.throwIfAborted()
  const creditBalance = await debitCredits(
    userId,
    creditSpent,
    `Không đủ credit cho kết quả AI này. Cần ${creditSpent} credit.`
  )
  let usageId: unknown
  let saved: LectureDocument | null | undefined
  updateAiTask({ creditDebited: creditSpent })
  const undoWrite = () =>
    rollbackAi(userId, creditSpent, usageId, saved, lecture, [
      'aiChatHistory',
      'contextSummary',
      ...(payload.sourceMaterial !== undefined ? ['sourceMaterial'] : [])
    ])
  try {
    signal?.throwIfAborted()
    saved = await LectureModel.findOneAndUpdate(
      {
        _id: lecture._id,
        userId,
        deletedAt: null,
        ...getRevisionFilter(lecture.revision ?? 0),
        updatedAt: lecture.updatedAt,
        [`aiChatHistory.${existingHistory.length}`]: { $exists: false }
      },
      {
        $set: {
          aiChatHistory: updatedHistory,
          contextSummary:
            aiResult.updatedSummary ?? lecture.get('contextSummary'),
          ...(payload.sourceMaterial !== undefined
            ? { sourceMaterial: payload.sourceMaterial }
            : {})
        }
      },
      { new: true }
    )
    if (!saved) {
      await getLecture(userId, lectureId)
      throw new AppError(
        'Bài giảng đã thay đổi. Vui lòng gửi lại yêu cầu AI.',
        409
      )
    }
    updateAiTask({ lectureId: String(lecture._id) })
    const usage = await AiUsageLogModel.create({
      userId,
      prompt: payload.message,
      slideCount: createdSlideCount,
      creditSpent
    })
    usageId = usage._id
    updateAiTask({ usageLogId: String(usageId) })
    signal?.throwIfAborted()
  } catch (error) {
    await undoWrite()
    throw error
  }

  const context = requestContext.getStore()
  if (context) context.undoUndelivered = undoWrite

  return {
    replacement: aiResult.replacement,
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
