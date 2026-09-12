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
  let mongoContainer: StartedMongoDBContainer
  let redisContainer: StartedRedisContainer

  beforeAll(async () => {
    mongoContainer = await new MongoDBContainer('mongo:8').start()
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
  }, 60000)

  afterEach(async () => {
    await clearDatabase()
  })

  afterAll(async () => {
    redis.disconnect(false)
    await mongoose.disconnect()
    await mongoContainer.stop()
    await redisContainer.stop()
  })
}
