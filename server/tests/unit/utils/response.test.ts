import type { Response } from 'express'
import { ok, okPaginated } from '@/utils/response'

describe('response utils', () => {
  const mockRes = () => {
    const res: Partial<Response> = {}
    res.status = jest.fn().mockReturnValue(res)
    res.json = jest.fn().mockReturnValue(res)
    return res as unknown as Response
  }

  describe('ok', () => {
    it('trả JSON response với success: true, data và status 200 mặc định', () => {
      const res = mockRes()
      const data = { id: '123', name: 'Test' }

      ok(res, data)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({ success: true, data })
    })

    it('trả đúng custom status code khi chỉ định (ví dụ 201 Created)', () => {
      const res = mockRes()
      const data = { id: 'created_id' }

      ok(res, data, 201)

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ success: true, data })
    })
  })

  describe('okPaginated', () => {
    it('trả JSON response phân trang chuẩn { items, total, page, limit }', () => {
      const res = mockRes()
      const items = [{ id: '1' }, { id: '2' }]

      okPaginated(res, items, 10, 1, 2)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          items,
          total: 10,
          page: 1,
          limit: 2
        }
      })
    })
  })
})
