import { asyncHandler } from '@/utils/asyncHandler'
import { ok, okPaginated } from '@/utils/response'
import * as adminService from '@/services/admin.service'

export const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
  const search =
    typeof req.query.search === 'string' ? req.query.search : undefined
  const { items, total } = await adminService.listUsers(page, limit, search)
  okPaginated(res, items, total, page, limit)
})

export const createUser = asyncHandler(async (req, res) => {
  const user = await adminService.createUser(req.body)
  ok(res, user, 201)
})

export const updateUser = asyncHandler(async (req, res) => {
  const user = await adminService.updateUser(String(req.params.id), req.body)
  ok(res, user)
})

export const lockUser = asyncHandler(async (req, res) => {
  const user = await adminService.lockUser(String(req.params.id))
  ok(res, user)
})

export const restoreUser = asyncHandler(async (req, res) => {
  const user = await adminService.restoreUser(String(req.params.id))
  ok(res, user)
})

export const deleteUser = asyncHandler(async (req, res) => {
  const result = await adminService.deleteUser(String(req.params.id))
  ok(res, result)
})

export const listAiUsage = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
  const userId =
    typeof req.query.userId === 'string' ? req.query.userId : undefined
  const from = typeof req.query.from === 'string' ? req.query.from : undefined
  const to = typeof req.query.to === 'string' ? req.query.to : undefined
  const { items, total } = await adminService.listAiUsage(
    page,
    limit,
    userId,
    from,
    to
  )
  okPaginated(res, items, total, page, limit)
})

export const getCreditConfig = asyncHandler(async (_req, res) => {
  const config = await adminService.getCreditConfig()
  ok(res, config)
})

export const updateCreditConfig = asyncHandler(async (req, res) => {
  const config = await adminService.updateCreditConfig(req.body)
  ok(res, config)
})
