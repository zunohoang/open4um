import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

export interface AiTask {
  requestId: string
  userId: string
  kind: 'outline' | 'outline-feedback' | 'lecture' | 'chat'
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout'
  httpStatus: number | null
  creditDebited: number
  creditRefunded: number
  usageLogId: string | null
  lectureId: string | null
  lectureRestored: boolean
  startedAt: string
  endedAt: string | null
}

export const requestContext = new AsyncLocalStorage<{
  requestId: string
  userId?: string
  undoUndelivered?: () => Promise<void>
  aiDelayMs?: number
  task?: AiTask
}>()
export const requestIdPattern = /^[A-Za-z0-9._-]{8,64}$/
export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  const supplied = req.get('X-Request-Id') ?? ''
  const requestId = requestIdPattern.test(supplied) ? supplied : randomUUID()
  res.setHeader('X-Request-Id', requestId)
  requestContext.run({ requestId }, next)
}

export function updateAiTask(fields: Partial<AiTask>) {
  const task = requestContext.getStore()?.task
  if (task) Object.assign(task, fields)
}
