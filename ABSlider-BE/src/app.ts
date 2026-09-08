import cors from 'cors'
import express from 'express'
import { healthRouter } from '@/routes/health.routes'
import { authRouter } from '@/routes/auth.routes'
import { lectureRouter } from '@/routes/lecture.routes'
import { folderRouter } from '@/routes/folder.routes'
import { adminRouter } from '@/routes/admin.routes'
import { errorMiddleware } from '@/middlewares/error.middleware'
import { requestLogMiddleware } from '@/middlewares/requestLog.middleware'

export const app = express()

app.use(cors())
app.use(express.json())
app.use(requestLogMiddleware)
app.use('/api/v1', healthRouter)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/lectures', lectureRouter)
app.use('/api/v1/folders', folderRouter)
app.use('/api/v1/admin', adminRouter)
app.use(errorMiddleware)
