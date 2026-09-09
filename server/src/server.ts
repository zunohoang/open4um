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

const start = async () => {
  await connectMongo()
  await connectRedis()
  await connectMinio()
  await runMigrations()
  await runSeed()
  initCronJobs()
  app.listen(env.PORT, () => {
    logger.info(`✅ ABSlider-BE đang chạy, lắng nghe trên cổng ${env.PORT}`)
  })
}

start()
