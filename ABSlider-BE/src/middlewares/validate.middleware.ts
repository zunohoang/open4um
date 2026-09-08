import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'
import { AppError } from '@/utils/AppError'

export const validate =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      throw new AppError(
        result.error.issues.map((issue) => issue.message).join(', '),
        422
      )
    }
    req.body = result.data
    next()
  }
