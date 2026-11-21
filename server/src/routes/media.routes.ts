import { env } from '@/config/env'
import { pipeline } from 'node:stream/promises'
import { Router } from 'express'
import { asyncHandler } from '@/utils/asyncHandler'
import { getImage } from '@/services/lecture.service'

export const mediaRouter = Router()

mediaRouter.get(
  '/images/:userId/:file',
  asyncHandler(async (req, res) => {
    const image = await getImage(
      `images/${String(req.params.userId)}/${String(req.params.file)}`
    )
    res.setHeader('Content-Type', image.contentType)
    res.setHeader('Content-Length', String(image.size))
    res.setHeader(
      'Cache-Control',
      env.QA_FAULTS_ENABLED ? 'no-store' : 'public, max-age=31536000, immutable'
    )
    res.setHeader('X-Content-Type-Options', 'nosniff')
    await pipeline(image.stream, res)
  })
)
