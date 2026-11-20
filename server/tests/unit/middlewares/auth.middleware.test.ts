import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '@/config/env'
import {
  requireAuth,
  requireAdmin,
  requireUser
} from '@/middlewares/auth.middleware'
import type { AccessTokenPayload } from '@/types/auth.types'
import { createHash } from 'node:crypto'

const mockUserFindById = jest.fn()
const mockUserSelect = jest.fn()
const mockRedisGet = jest.fn()

jest.mock('@/models/user.model', () => ({
  UserModel: {
    findById: (...args: unknown[]) => mockUserFindById(...args)
  }
}))

jest.mock('@/lib/redis', () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args)
  }
}))

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
    mockUserSelect.mockReset().mockResolvedValue({
      status: 'active',
      role: 'user',
      tokenVersion: 2
    })
    mockUserFindById.mockReset().mockReturnValue({ select: mockUserSelect })
    mockRedisGet.mockReset().mockResolvedValue(null)
  })

  describe('requireAuth', () => {
    const payload: AccessTokenPayload = {
      id: 'a'.repeat(24),
      role: 'user',
      type: 'access',
      sessionId: 'session-123',
      tokenVersion: 2
    }

    const authorize = (overrides: Partial<AccessTokenPayload> = {}) => {
      const token = jwt.sign({ ...payload, ...overrides }, env.JWT_SECRET)
      req.headers = { authorization: `Bearer ${token}` }
      return token
    }

    it('ném AppError 401 khi không có Authorization header', async () => {
      await expect(
        requireAuth(req as Request, res as Response, next)
      ).rejects.toMatchObject({ statusCode: 401, message: 'Chưa đăng nhập' })
      expect(mockUserFindById).not.toHaveBeenCalled()
      expect(next).not.toHaveBeenCalled()
    })

    it('ném AppError 401 khi token không hợp lệ', async () => {
      req.headers = { authorization: 'Bearer invalid_token' }

      await expect(
        requireAuth(req as Request, res as Response, next)
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Token không hợp lệ'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('ném AppError 401 khi token type không phải là access', async () => {
      const refreshPayload = { id: 'u1', role: 'user', type: 'refresh' }
      const token = jwt.sign(refreshPayload, env.JWT_SECRET)
      req.headers = { authorization: `Bearer ${token}` }

      await expect(
        requireAuth(req as Request, res as Response, next)
      ).rejects.toMatchObject({
        statusCode: 401,
        message: expect.stringContaining('Token không hợp lệ')
      })
      expect(mockUserFindById).not.toHaveBeenCalled()
      expect(next).not.toHaveBeenCalled()
    })

    it('từ chối access token cũ không có sessionId', async () => {
      authorize({ sessionId: undefined })

      await expect(
        requireAuth(req as Request, res as Response, next)
      ).rejects.toMatchObject({ statusCode: 401 })
      expect(mockUserFindById).not.toHaveBeenCalled()
      expect(next).not.toHaveBeenCalled()
    })

    it('gán req.user và gọi next() khi token và phiên còn hợp lệ', async () => {
      authorize()

      await requireAuth(req as Request, res as Response, next)

      expect(req.user).toMatchObject(payload)
      expect(mockUserFindById).toHaveBeenCalledWith(payload.id)
      expect(next).toHaveBeenCalledTimes(1)
    })

    it('từ chối ngay tài khoản đã bị khóa dù access token còn hạn', async () => {
      authorize()
      mockUserSelect.mockResolvedValue({
        status: 'locked',
        role: 'user',
        tokenVersion: 2
      })

      await expect(
        requireAuth(req as Request, res as Response, next)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('khóa')
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('từ chối access token đã bị blacklist sau đăng xuất', async () => {
      const token = authorize()
      const key = `blacklist:access:${createHash('sha256').update(token).digest('hex')}`
      mockRedisGet.mockImplementation(async (requestedKey: string) =>
        requestedKey === key ? '1' : null
      )

      await expect(
        requireAuth(req as Request, res as Response, next)
      ).rejects.toMatchObject({ statusCode: 401 })
      expect(mockRedisGet).toHaveBeenCalledWith(key)
      expect(next).not.toHaveBeenCalled()
    })

    it('từ chối access token thuộc phiên đăng nhập đã bị thu hồi', async () => {
      authorize()
      mockRedisGet.mockImplementation(async (key: string) =>
        key === `blacklist:${payload.sessionId}` ? '1' : null
      )

      await expect(
        requireAuth(req as Request, res as Response, next)
      ).rejects.toMatchObject({ statusCode: 401 })
      expect(next).not.toHaveBeenCalled()
    })

    it('từ chối phiên cũ sau khi đổi mật khẩu', async () => {
      authorize({ tokenVersion: 1 })

      await expect(
        requireAuth(req as Request, res as Response, next)
      ).rejects.toMatchObject({ statusCode: 401 })
      expect(next).not.toHaveBeenCalled()
    })

    it('từ chối phiên của tài khoản đã bị xóa', async () => {
      authorize()
      mockUserSelect.mockResolvedValue(null)

      await expect(
        requireAuth(req as Request, res as Response, next)
      ).rejects.toMatchObject({ statusCode: 401 })
      expect(next).not.toHaveBeenCalled()
    })

    it('lấy vai trò hiện tại từ database thay cho vai trò cũ trong token', async () => {
      authorize({ role: 'admin' })

      await requireAuth(req as Request, res as Response, next)

      expect(req.user?.role).toBe('user')
      expect(next).toHaveBeenCalledTimes(1)
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
