import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { validate } from '@/middlewares/validate.middleware'
import { AppError } from '@/utils/AppError'

describe('validate.middleware', () => {
  const dummySchema = z.object({
    title: z.string().min(3, 'Tiêu đề phải ít nhất 3 ký tự'),
    count: z.number().int().positive('Số lượng phải là số dương')
  })

  let req: Partial<Request>
  let res: Partial<Response>
  let next: NextFunction

  beforeEach(() => {
    res = {}
    next = jest.fn()
  })

  it('gọi next() và gán data đã parse vào req.body khi dữ liệu hợp lệ', () => {
    req = {
      body: {
        title: 'Tiêu đề chuẩn',
        count: 5
      }
    }

    const middleware = validate(dummySchema)
    middleware(req as Request, res as Response, next)

    expect(next).toHaveBeenCalled()
    expect(req.body).toEqual({
      title: 'Tiêu đề chuẩn',
      count: 5
    })
  })

  it('ném AppError với status 422 khi dữ liệu không hợp lệ', () => {
    req = {
      body: {
        title: 'ab',
        count: -1
      }
    }

    const middleware = validate(dummySchema)

    expect(() => middleware(req as Request, res as Response, next)).toThrow(
      AppError
    )
    try {
      middleware(req as Request, res as Response, next)
    } catch (err: any) {
      expect(err.statusCode).toBe(422)
      expect(err.message).toContain('Tiêu đề phải ít nhất 3 ký tự')
    }
  })
})
