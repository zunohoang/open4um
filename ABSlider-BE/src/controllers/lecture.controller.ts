import { asyncHandler } from '@/utils/asyncHandler'
import { ok, okPaginated } from '@/utils/response'
import * as lectureService from '@/services/lecture.service'

export const generateOutline = asyncHandler(async (req, res) => {
  const result = await lectureService.generateOutline(
    req.user.id,
    req.body.prompt
  )
  ok(res, result)
})

export const createLecture = asyncHandler(async (req, res) => {
  const lecture = await lectureService.createLecture(req.user.id, req.body)
  ok(res, lecture, 201)
})

export const createBlankLecture = asyncHandler(async (req, res) => {
  const lecture = await lectureService.createBlankLecture(
    req.user.id,
    req.body.title,
    req.body.folderId
  )
  ok(res, lecture, 201)
})

export const listLectures = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
  const folderId =
    typeof req.query.folderId === 'string' ? req.query.folderId : undefined
  const search =
    typeof req.query.search === 'string' ? req.query.search : undefined
  const allowedSortFields = new Set(['updatedAt', 'createdAt', 'title'])
  const requestedSort =
    typeof req.query.sortBy === 'string' ? req.query.sortBy : 'updatedAt'
  const sortBy = allowedSortFields.has(requestedSort)
    ? (requestedSort as 'updatedAt' | 'createdAt' | 'title')
    : 'updatedAt'
  const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc'
  const { items, total } = await lectureService.listLectures({
    userId: req.user.id,
    folderId,
    search,
    sortBy,
    sortOrder,
    page,
    limit
  })
  okPaginated(res, items, total, page, limit)
})

export const listTrash = asyncHandler(async (req, res) => {
  const items = await lectureService.listTrash(req.user.id)
  ok(res, items)
})

export const getLecture = asyncHandler(async (req, res) => {
  const lecture = await lectureService.getLecture(
    req.user.id,
    String(req.params.id)
  )
  ok(res, lecture)
})

export const updateLecture = asyncHandler(async (req, res) => {
  const lecture = await lectureService.updateLecture(
    req.user.id,
    String(req.params.id),
    req.body
  )
  ok(res, lecture)
})

export const duplicateLecture = asyncHandler(async (req, res) => {
  const lecture = await lectureService.duplicateLecture(
    req.user.id,
    String(req.params.id)
  )
  ok(res, lecture, 201)
})

export const applySlideOperation = asyncHandler(async (req, res) => {
  const lecture = await lectureService.applySlideOperation(
    req.user.id,
    String(req.params.id),
    req.body
  )
  ok(res, lecture)
})

export const autosaveLecture = asyncHandler(async (req, res) => {
  const lecture = await lectureService.updateLecture(
    req.user.id,
    String(req.params.id),
    req.body
  )
  ok(res, { lecture, savedAt: lecture.updatedAt })
})

export const deleteLecture = asyncHandler(async (req, res) => {
  const result = await lectureService.deleteLecture(
    req.user.id,
    String(req.params.id)
  )
  ok(res, result)
})

export const restoreLecture = asyncHandler(async (req, res) => {
  const lecture = await lectureService.restoreLecture(
    req.user.id,
    String(req.params.id)
  )
  ok(res, lecture)
})

export const editSlideWithAi = asyncHandler(async (req, res) => {
  const result = await lectureService.editSlideWithAi(
    req.user.id,
    String(req.params.id),
    req.body.slideId,
    req.body.instruction
  )
  ok(res, result)
})

export const getPresentation = asyncHandler(async (req, res) => {
  const lecture = await lectureService.getLecture(
    req.user.id,
    String(req.params.id)
  )
  ok(res, {
    id: lecture._id,
    title: lecture.title,
    pattern: lecture.pattern,
    slides: lecture.slides,
    updatedAt: lecture.updatedAt
  })
})

export const exportLecture = asyncHandler(async (req, res) => {
  const result = await lectureService.exportLecture(
    req.user.id,
    String(req.params.id)
  )
  ok(res, result)
})
