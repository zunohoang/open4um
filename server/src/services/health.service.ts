import mongoose from 'mongoose'
import { env } from '@/config/env'
import { redis } from '@/lib/redis'
import { BUCKET_MEDIA, minioClient } from '@/lib/minio'

type DependencyName = 'mongo' | 'redis' | 'minio'
type DependencyStatus = 'up' | 'down'

export type ReadinessResult = {
  status: 'ready' | 'not_ready'
  checks: Record<DependencyName, DependencyStatus>
}

let shuttingDown = false

export const setShuttingDown = (value: boolean) => {
  shuttingDown = value
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Health check timed out after ${timeoutMs}ms`)),
      timeoutMs
    )
    timeout.unref()

    promise.then(
      (value) => {
        clearTimeout(timeout)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timeout)
        reject(error)
      }
    )
  })
}

const checkMongo = async () => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw new Error('MongoDB is not connected')
  }

  await mongoose.connection.db.admin().command({ ping: 1 })
}

const checkRedis = async () => {
  await redis.ping()
}

const checkMinio = async () => {
  const bucketExists = await minioClient.bucketExists(BUCKET_MEDIA)
  if (!bucketExists) {
    throw new Error('Required MinIO bucket is unavailable')
  }
}

const dependencyChecks: Record<DependencyName, () => Promise<void>> = {
  mongo: checkMongo,
  redis: checkRedis,
  minio: checkMinio
}

export const getReadiness = async (): Promise<ReadinessResult> => {
  const names = Object.keys(dependencyChecks) as DependencyName[]

  if (shuttingDown) {
    return {
      status: 'not_ready',
      checks: { mongo: 'down', redis: 'down', minio: 'down' }
    }
  }

  const results = await Promise.all(
    names.map(async (name) => {
      try {
        await withTimeout(dependencyChecks[name](), env.HEALTH_CHECK_TIMEOUT_MS)
        return [name, 'up'] as const
      } catch {
        return [name, 'down'] as const
      }
    })
  )
  const checks = Object.fromEntries(results) as Record<
    DependencyName,
    DependencyStatus
  >
  const ready = Object.values(checks).every((status) => status === 'up')

  return { status: ready ? 'ready' : 'not_ready', checks }
}
