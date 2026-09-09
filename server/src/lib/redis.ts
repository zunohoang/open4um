import Redis from 'ioredis'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'

export const redis = new Redis(env.REDIS_URL)

export const connectRedis = async () => {
  try {
    if (redis.status === 'wait') {
      await redis.connect()
    }
    await redis.ping()
    logger.info('✅ Kết nối Redis')
  } catch (err) {
    logger.error({ err }, '❌ Kết nối Redis thất bại')
    throw err
  }
}
