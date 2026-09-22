import mongoose from 'mongoose'
import {
  MongoDBContainer,
  type StartedMongoDBContainer
} from '@testcontainers/mongodb'
import {
  RedisContainer,
  type StartedRedisContainer
} from '@testcontainers/redis'
import { redis } from '@/lib/redis'

export const clearDatabase = async () => {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
  await redis.flushdb()
}

export const setupTestDb = () => {
  let mongoContainer: StartedMongoDBContainer | undefined
  let redisContainer: StartedRedisContainer | undefined
  let setupComplete = false

  beforeAll(async () => {
    mongoContainer = await new MongoDBContainer('mongo:8')
      .withEnvironment({ GLIBC_TUNABLES: 'glibc.pthread.rseq=1' })
      .start()
    const mongoUri = `${mongoContainer.getConnectionString()}?directConnection=true`
    await mongoose.connect(mongoUri)

    redisContainer = await new RedisContainer('redis:7-alpine').start()

    if (redis.status !== 'end' && redis.status !== 'wait') {
      await new Promise<void>((resolve) => {
        redis.once('end', () => resolve())
        redis.disconnect(false)
        setTimeout(resolve, 500)
      })
    }

    redis.options.host = redisContainer.getHost()
    redis.options.port = redisContainer.getMappedPort(6379)
    await redis.connect()
    setupComplete = true
  }, 180000)

  afterEach(async () => {
    if (setupComplete) {
      await clearDatabase()
    }
  }, 30000)

  afterAll(async () => {
    setupComplete = false

    if (redis.status !== 'end') {
      redis.disconnect(false)
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }

    const containerCleanup = []
    if (redisContainer) {
      containerCleanup.push(redisContainer.stop())
    }
    if (mongoContainer) {
      containerCleanup.push(mongoContainer.stop())
    }
    await Promise.all(containerCleanup)
  }, 60000)
}
