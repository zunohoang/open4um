import type { NextFunction, Request, Response } from 'express'
import { asyncHandler } from '@/utils/asyncHandler'

describe('asyncHandler util', () => {
  const req = {} as Request
  const res = {} as Response
  const next = jest.fn() as NextFunction

  it('thực thi async handler thành công mà không gọi next với lỗi', async () => {
    const handler = jest.fn().mockResolvedValue('ok')
    const wrapped = asyncHandler(handler)

    await wrapped(req, res, next)

    expect(handler).toHaveBeenCalledWith(req, res, next)
    expect(next).not.toHaveBeenCalled()
  })

  it('bắt lỗi phát sinh từ async handler và chuyển cho next(err)', async () => {
    const error = new Error('Async failure')
    const handler = jest.fn().mockRejectedValue(error)
    const wrapped = asyncHandler(handler)

    await wrapped(req, res, next)

    expect(handler).toHaveBeenCalledWith(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
})
