import type { Response } from 'express'

export const ok = <T>(res: Response, data: T, status = 200) => {
  res.status(status).json({ success: true, data })
}

export const okPaginated = <T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  limit: number
) => {
  res.json({ success: true, data: { items, total, page, limit } })
}
