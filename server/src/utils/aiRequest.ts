import type { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { env } from '@/config/env'
import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import {
  requestContext,
  type AiTask
} from '@/middlewares/requestContext.middleware'
import { getFault } from '@/services/qa.service'
import { ok } from '@/utils/response'
import { AppError } from '@/utils/AppError'

export const withAiRequest = async <T>(
  req: Request,
  res: Response,
  kind: AiTask['kind'],
  work: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
  const context = requestContext.getStore()!
  const controller = new AbortController()
  const cancel = () => {
    if (!res.writableFinished)
      controller.abort(new AppError('Yêu cầu AI đã bị hủy', 499))
  }
  req.once('aborted', cancel)
  res.once('close', cancel)
  if (req.aborted || res.destroyed) cancel()
  const task: AiTask = {
    requestId: context.requestId,
    userId: req.user.id,
    kind,
    status: 'running',
    httpStatus: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    creditDebited: 0,
    creditRefunded: 0,
    lectureId: null,
    usageLogId: null,
    lectureRestored: false
  }
  context.task = task
  let timer: ReturnType<typeof setTimeout> | undefined
  let recorded = false
  try {
    timer = setTimeout(
      () =>
        controller.abort(
          new AppError(
            'AI phản hồi quá lâu. Vui lòng thử lại; yêu cầu này không bị tính credit.',
            504
          )
        ),
      env.AI_REQUEST_TIMEOUT_MS
    )
    const delay = await getFault('ai_delay', task.userId)
    if (delay?.bypassAppTimeout) clearTimeout(timer)
    // Reserve the ID so a repeated client header cannot overwrite another request's outcome.
    while (
      !(await redis.set(
        'qa:ai-task:' + task.requestId,
        JSON.stringify(task),
        'EX',
        86400,
        'NX'
      ))
    ) {
      task.requestId = context.requestId = randomUUID()
      res.setHeader('X-Request-Id', task.requestId)
    }
    recorded = true
    context.aiDelayMs = delay?.delayMs
    controller.signal.throwIfAborted()
    const result = await work(controller.signal)
    controller.signal.throwIfAborted()
    // Keep compensation available until Node has finished writing the response.
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        res.off('finish', finish)
        controller.signal.removeEventListener('abort', abort)
      }
      const finish = () => {
        cleanup()
        resolve()
      }
      const abort = () => {
        cleanup()
        reject(controller.signal.reason)
      }
      res.once('finish', finish)
      controller.signal.addEventListener('abort', abort, { once: true })
      try {
        ok(res, result, kind === 'lecture' ? 201 : 200)
        if (res.writableFinished) finish()
      } catch (error) {
        cleanup()
        reject(error)
      }
    })
    task.status = 'completed'
    task.httpStatus = kind === 'lecture' ? 201 : 200
    return result
  } catch (err) {
    if (context.undoUndelivered) await context.undoUndelivered()
    const error = controller.signal.aborted ? controller.signal.reason : err
    task.httpStatus = error instanceof AppError ? error.statusCode : 500
    task.status =
      task.httpStatus === 499
        ? 'cancelled'
        : task.httpStatus === 504
          ? 'timeout'
          : 'failed'
    throw error
  } finally {
    delete context.undoUndelivered
    clearTimeout(timer)
    req.off('aborted', cancel)
    res.off('close', cancel)
    task.endedAt = new Date().toISOString()
    if (recorded)
      void redis
        .set('qa:ai-task:' + task.requestId, JSON.stringify(task), 'EX', 86400)
        .catch((err) =>
          logger.error(
            { err, requestId: task.requestId },
            'Không ghi được kết quả yêu cầu AI'
          )
        )
  }
}
