import pino from 'pino'
import pretty from 'pino-pretty'
import { env } from '@/config/env'

if (process.platform === 'win32') {
  try {
    const { execSync } = require('child_process')
    execSync('chcp 65001', { stdio: 'ignore' })
  } catch {
    // Bỏ qua nếu môi trường không hỗ trợ lệnh chcp
  }
}

const stream =
  env.NODE_ENV !== 'production'
    ? pretty({
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
        destination: process.stdout
      })
    : undefined

export const logger = pino(
  {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug'
  },
  stream
)
