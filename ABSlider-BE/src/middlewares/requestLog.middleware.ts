import type { RequestHandler } from 'express'
import { logger } from '@/lib/logger'

export const requestLogMiddleware: RequestHandler = (req, res, next) => {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    const status = res.statusCode
    const line = `HTTP/${req.httpVersion} ${req.method} ${status} ${duration}ms ${req.originalUrl || req.url}`

    if (status >= 500) logger.error(`- ${line}`)
    else if (status >= 400) logger.warn(`- ${line}`)
    else logger.info(`- ${line}`)
  })

  next()
}
