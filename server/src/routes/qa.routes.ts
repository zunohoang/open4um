import { Router } from 'express'
import { requireAuth, requireAdmin } from '@/middlewares/auth.middleware'
import { requestIdPattern } from '@/middlewares/requestContext.middleware'
import { validate } from '@/middlewares/validate.middleware'
import { env } from '@/config/env'
import { redis } from '@/lib/redis'
import { AI_CALL_TIMEOUT_MS } from '@/services/ai.service'
import {
  faultFilter,
  faultSchema,
  listFaults,
  setFault
} from '@/services/qa.service'
import { AppError } from '@/utils/AppError'
import { ok } from '@/utils/response'

export const qaRouter = Router()
qaRouter.use(requireAuth, requireAdmin)
qaRouter.get('/faults', async (_req, res) => {
  const { active } = await listFaults()
  ok(res, {
    enabled: true,
    aiRequestTimeoutMs: env.AI_REQUEST_TIMEOUT_MS,
    aiCallTimeoutMs: AI_CALL_TIMEOUT_MS,
    gatewayReadTimeoutSec: env.GATEWAY_READ_TIMEOUT_SEC ?? null,
    active
  })
})
qaRouter.put('/faults', validate(faultSchema), async (req, res) => {
  ok(res, await setFault(req.body))
})
qaRouter.delete('/faults', async (req, res) => {
  const filter = faultFilter.safeParse(req.query)
  if (!filter.success) throw new AppError('Bộ lọc không hợp lệ', 422)
  const { cleared } = await listFaults(filter.data, true)
  ok(res, { cleared })
})
qaRouter.get('/ai-tasks/:requestId', async (req, res) => {
  const id = req.params.requestId
  const raw = requestIdPattern.test(id) && (await redis.get(`qa:ai-task:${id}`))
  if (!raw) throw new AppError('Không tìm thấy yêu cầu AI', 404)
  ok(res, JSON.parse(raw))
})
