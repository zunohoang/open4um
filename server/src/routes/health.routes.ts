import { Router, type Request, type Response } from 'express'
import { env } from '@/config/env'
import { getReadiness } from '@/services/health.service'

export const healthRouter = Router()

const release = {
  sha: env.RELEASE_SHA ?? null,
  environment: env.RELEASE_ENVIRONMENT ?? null
}

const liveness = (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', release } })
}

healthRouter.get('/health', liveness)
healthRouter.get('/health/live', liveness)

healthRouter.get('/version', (_req, res) => {
  res.json({ success: true, data: { release } })
})

healthRouter.get('/health/ready', async (_req, res) => {
  const readiness = await getReadiness()
  const ready = readiness.status === 'ready'

  res.status(ready ? 200 : 503).json({
    success: ready,
    data: { ...readiness, release }
  })
})
