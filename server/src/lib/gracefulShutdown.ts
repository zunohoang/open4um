import type { Server } from 'node:http'
import type { ScheduledTask } from 'node-cron'
import mongoose from 'mongoose'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import { redis } from '@/lib/redis'
import { setShuttingDown } from '@/services/health.service'

type ShutdownSignal = 'SIGINT' | 'SIGTERM'

type ShutdownOptions = {
  server: Pick<Server, 'close' | 'closeAllConnections'>
  cronJobs: Array<Pick<ScheduledTask, 'stop'>>
  timeoutMs?: number
  markNotReady?: () => void
  disconnectMongo?: () => Promise<void>
  disconnectRedis?: () => Promise<void>
  setExitCode?: (code: number) => void
}

const closeRedis = async () => {
  if (redis.status === 'end') return

  if (redis.status === 'wait') {
    redis.disconnect(false)
    return
  }

  try {
    await redis.quit()
  } catch (error) {
    redis.disconnect(false)
    throw error
  }
}

const closeHttpServer = async (
  server: ShutdownOptions['server'],
  timeoutMs: number
) => {
  return new Promise<void>((resolve, reject) => {
    let settled = false

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      error ? reject(error) : resolve()
    }

    const timeout = setTimeout(() => {
      server.closeAllConnections()
      finish(new Error(`HTTP shutdown timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    timeout.unref()

    server.close((error) => finish(error))
  })
}

export const createGracefulShutdown = ({
  server,
  cronJobs,
  timeoutMs = env.SHUTDOWN_TIMEOUT_MS,
  markNotReady = () => setShuttingDown(true),
  disconnectMongo = () => mongoose.disconnect(),
  disconnectRedis = closeRedis,
  setExitCode = (code) => {
    process.exitCode = code
  }
}: ShutdownOptions) => {
  let shutdownStarted = false

  return async (signal: ShutdownSignal) => {
    if (shutdownStarted) return
    shutdownStarted = true
    markNotReady()

    logger.info({ signal }, 'Bắt đầu graceful shutdown')

    const cronResults = await Promise.allSettled(
      cronJobs.map((task) => Promise.resolve(task.stop()))
    )

    let httpResult: PromiseSettledResult<void>
    try {
      await closeHttpServer(server, timeoutMs)
      httpResult = { status: 'fulfilled', value: undefined }
    } catch (reason) {
      httpResult = { status: 'rejected', reason }
    }

    const dependencyResults = await Promise.allSettled([
      disconnectMongo(),
      disconnectRedis()
    ])
    const results = [...cronResults, httpResult, ...dependencyResults]
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )

    if (failures.length > 0) {
      logger.error(
        { errors: failures.map((failure) => failure.reason) },
        'Graceful shutdown hoàn tất nhưng có lỗi'
      )
      setExitCode(1)
      return
    }

    logger.info('Graceful shutdown hoàn tất')
  }
}
