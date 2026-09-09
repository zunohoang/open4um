import type { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '@/config/env'
import { AppError } from '@/utils/AppError'
import type { AccessTokenPayload } from '@/types/auth.types'

declare global {
  namespace Express {
    interface Request {
      user: AccessTokenPayload
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) throw new AppError('Chưa đăng nhập', 401)

  let payload: AccessTokenPayload
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Token đã hết hạn', 401)
    }
    throw new AppError('Token không hợp lệ', 401)
  }

  if (payload.type !== 'access') throw new AppError('Token không hợp lệ', 401)
  req.user = payload
  next()
}

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user.role !== 'admin')
    throw new AppError('Không có quyền truy cập', 403)
  next()
}

export const requireUser: RequestHandler = (req, _res, next) => {
  if (req.user.role !== 'user')
    throw new AppError('Không có quyền thực hiện thao tác người dùng', 403)
  next()
}
