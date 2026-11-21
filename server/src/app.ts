import cors from 'cors'
import express from 'express'
import { healthRouter } from '@/routes/health.routes'
import { authRouter } from '@/routes/auth.routes'
import { lectureRouter } from '@/routes/lecture.routes'
import { folderRouter } from '@/routes/folder.routes'
import { adminRouter } from '@/routes/admin.routes'
import { mediaRouter } from '@/routes/media.routes'
import { errorMiddleware } from '@/middlewares/error.middleware'
import { requestLogMiddleware } from '@/middlewares/requestLog.middleware'
import { corsOptions } from '@/config/cors'

import { requestContextMiddleware } from '@/middlewares/requestContext.middleware'
import { qaRouter } from '@/routes/qa.routes'
import { env } from '@/config/env'

export const app = express()

app.use(requestContextMiddleware)
app.use(requestLogMiddleware)
app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
if (env.QA_FAULTS_ENABLED) app.use('/api/v1/qa', qaRouter)
app.use('/api/v1', healthRouter)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/lectures', lectureRouter)
app.use('/api/v1/folders', folderRouter)
app.use('/api/v1/admin', adminRouter)
app.use('/api/v1/media', mediaRouter)
app.use(errorMiddleware)
