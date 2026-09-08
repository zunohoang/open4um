import mongoose from 'mongoose'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'

export const connectMongo = async () => {
  await mongoose.connect(env.MONGO_URI)
  logger.info('✅ Kết nối MongoDB')
}
