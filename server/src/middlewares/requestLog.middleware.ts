import type { RequestHandler } from 'express'
import { logger } from '@/lib/logger'

export const requestLogMiddleware: RequestHandler = (req, res, next) => {
  const start = Date.now()

  const log = (status: number) => {
    const duration = Date.now() - start
    const line = `HTTP/${req.httpVersion} ${res.getHeader('X-Request-Id')} ${req.method} ${status} ${duration}ms ${req.originalUrl || req.url}`

    if (status >= 500) logger.error(`- ${line}`)
    else if (status >= 400) logger.warn(`- ${line}`)
    else logger.info(`- ${line}`)
  }
  res.once('finish', () => log(res.statusCode))
  res.once('close', () => {
    if (!res.writableFinished) log(499)
  })
  next()
}
