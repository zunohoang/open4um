import 'dotenv/config'
import { app } from '@/app'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import { connectMongo } from '@/lib/mongo'
import { connectRedis } from '@/lib/redis'
import { connectMinio } from '@/lib/minio'
import { runMigrations } from '@/migrations/runner'
import { runSeed } from '@/lib/seed'
import { initCronJobs } from '@/cron'
import { createGracefulShutdown } from '@/lib/gracefulShutdown'

const start = async () => {
  await connectMongo()
  await connectRedis()
  await connectMinio()
  await runMigrations()
  await runSeed()
  const cronJobs = initCronJobs()
  const server = app.listen(env.PORT, () => {
    logger.info(`✅ ABSlider-BE đang chạy, lắng nghe trên cổng ${env.PORT}`)
  })
  const shutdown = createGracefulShutdown({ server, cronJobs })

  process.once('SIGTERM', () => void shutdown('SIGTERM'))
  process.once('SIGINT', () => void shutdown('SIGINT'))
}

start().catch((error) => {
  logger.fatal({ error }, 'Không thể khởi động ABSlider-BE')
  process.exitCode = 1
})
