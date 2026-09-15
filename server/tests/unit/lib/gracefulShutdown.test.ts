import type { Server } from 'node:http'
import { createGracefulShutdown } from '@/lib/gracefulShutdown'

jest.mock('mongoose', () => ({
  __esModule: true,
  default: { disconnect: jest.fn() }
}))

jest.mock('@/lib/redis', () => ({
  redis: { status: 'end' }
}))

jest.mock('@/services/health.service', () => ({
  setShuttingDown: jest.fn()
}))

describe('createGracefulShutdown', () => {
  it('đánh dấu not-ready, dừng cron, đóng HTTP và dependency đúng một lần', async () => {
    const close = jest.fn((callback: (error?: Error) => void) => callback())
    const closeAllConnections = jest.fn()
    const stopCron = jest.fn()
    const markNotReady = jest.fn()
    const disconnectMongo = jest.fn().mockResolvedValue(undefined)
    const disconnectRedis = jest.fn().mockResolvedValue(undefined)
    const setExitCode = jest.fn()
    const shutdown = createGracefulShutdown({
      server: { close, closeAllConnections } as unknown as Server,
      cronJobs: [{ stop: stopCron }],
      timeoutMs: 100,
      markNotReady,
      disconnectMongo,
      disconnectRedis,
      setExitCode
    })

    await shutdown('SIGTERM')
    await shutdown('SIGINT')

    expect(markNotReady).toHaveBeenCalledTimes(1)
    expect(stopCron).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
    expect(closeAllConnections).not.toHaveBeenCalled()
    expect(disconnectMongo).toHaveBeenCalledTimes(1)
    expect(disconnectRedis).toHaveBeenCalledTimes(1)
    expect(setExitCode).not.toHaveBeenCalled()
  })

  it('ép đóng connection và đặt exit code 1 khi HTTP shutdown quá hạn', async () => {
    const close = jest.fn()
    const closeAllConnections = jest.fn()
    const setExitCode = jest.fn()
    const shutdown = createGracefulShutdown({
      server: { close, closeAllConnections } as unknown as Server,
      cronJobs: [],
      timeoutMs: 5,
      disconnectMongo: jest.fn().mockResolvedValue(undefined),
      disconnectRedis: jest.fn().mockResolvedValue(undefined),
      setExitCode
    })

    await shutdown('SIGTERM')

    expect(closeAllConnections).toHaveBeenCalledTimes(1)
    expect(setExitCode).toHaveBeenCalledWith(1)
  })
})
