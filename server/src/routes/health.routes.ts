import { Router, type Request, type Response } from 'express'
import { getReadiness } from '@/services/health.service'

export const healthRouter = Router()

const liveness = (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok' } })
}

healthRouter.get('/health', liveness)
healthRouter.get('/health/live', liveness)

healthRouter.get('/health/ready', async (_req, res) => {
  const readiness = await getReadiness()
  const ready = readiness.status === 'ready'

  res.status(ready ? 200 : 503).json({ success: ready, data: readiness })
})
