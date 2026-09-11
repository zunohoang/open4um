import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '@/config/env'
import {
  requireAuth,
  requireAdmin,
  requireUser
} from '@/middlewares/auth.middleware'
import type { AccessTokenPayload } from '@/types/auth.types'

describe('auth.middleware', () => {
  let req: Partial<Request>
  let res: Partial<Response>
  let next: NextFunction

  beforeEach(() => {
    req = {
      headers: {}
    }
    res = {}
    next = jest.fn()
  })

  describe('requireAuth', () => {
    it('ném AppError 401 khi không có Authorization header', () => {
      expect(() => requireAuth(req as Request, res as Response, next)).toThrow(
        expect.objectContaining({
          statusCode: 401,
          message: 'Chưa đăng nhập'
        })
      )
    })

    it('ném AppError 401 khi token không hợp lệ', () => {
      req.headers = { authorization: 'Bearer invalid_token' }

      expect(() => requireAuth(req as Request, res as Response, next)).toThrow(
        expect.objectContaining({
          statusCode: 401,
          message: 'Token không hợp lệ'
        })
      )
    })

    it('ném AppError 401 khi token type không phải là access', () => {
      const refreshPayload = { id: 'u1', role: 'user', type: 'refresh' }
      const token = jwt.sign(refreshPayload, env.JWT_SECRET)
      req.headers = { authorization: `Bearer ${token}` }

      expect(() => requireAuth(req as Request, res as Response, next)).toThrow(
        expect.objectContaining({
          statusCode: 401,
          message: 'Token không hợp lệ'
        })
      )
    })

    it('gán req.user và gọi next() khi token hợp lệ', () => {
      const payload: AccessTokenPayload = {
        id: 'user-123',
        role: 'user',
        type: 'access'
      }
      const token = jwt.sign(payload, env.JWT_SECRET)
      req.headers = { authorization: `Bearer ${token}` }

      requireAuth(req as Request, res as Response, next)

      expect(req.user).toMatchObject({ id: 'user-123', role: 'user' })
      expect(next).toHaveBeenCalled()
    })
  })

  describe('requireAdmin', () => {
    it('ném lỗi 403 khi role không phải admin', () => {
      req.user = { id: 'user-1', role: 'user', type: 'access' }

      expect(() => requireAdmin(req as Request, res as Response, next)).toThrow(
        expect.objectContaining({
          statusCode: 403
        })
      )
    })

    it('gọi next() khi role là admin', () => {
      req.user = { id: 'admin-1', role: 'admin', type: 'access' }

      requireAdmin(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
    })
  })

  describe('requireUser', () => {
    it('ném lỗi 403 khi role không phải user', () => {
      req.user = { id: 'admin-1', role: 'admin', type: 'access' }

      expect(() => requireUser(req as Request, res as Response, next)).toThrow(
        expect.objectContaining({
          statusCode: 403
        })
      )
    })

    it('gọi next() khi role là user', () => {
      req.user = { id: 'user-1', role: 'user', type: 'access' }

      requireUser(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
    })
  })
})
