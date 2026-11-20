import type { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { createHash } from 'node:crypto'
import { env } from '@/config/env'
import { AppError } from '@/utils/AppError'
import type { AccessTokenPayload } from '@/types/auth.types'
import { UserModel } from '@/models/user.model'
import { redis } from '@/lib/redis'

declare global {
  namespace Express {
    interface Request {
      user: AccessTokenPayload
    }
  }
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
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

  if (payload.type !== 'access' || !payload.sessionId)
    throw new AppError(
      'Token không hợp lệ, vui lòng làm mới phiên đăng nhập',
      401
    )
  const [user, revokedAccess, revokedSession] = await Promise.all([
    UserModel.findById(payload.id).select('status role tokenVersion'),
    redis.get(
      `blacklist:access:${createHash('sha256').update(token).digest('hex')}`
    ),
    payload.sessionId ? redis.get(`blacklist:${payload.sessionId}`) : null
  ])
  if (user?.status === 'locked') {
    throw new AppError(
      'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      403
    )
  }
  if (
    !user ||
    revokedAccess ||
    revokedSession ||
    (payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)
  ) {
    throw new AppError(
      'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.',
      401
    )
  }
  req.user = { ...payload, role: user.role }
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
