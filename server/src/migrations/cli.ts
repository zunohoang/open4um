import 'dotenv/config'
import mongoose from 'mongoose'
import { connectMongo } from '@/lib/mongo'
import { logger } from '@/lib/logger'
import { runMigrations, rollbackMigration } from '@/migrations/runner'

const main = async () => {
  try {
    await connectMongo()

    const isDown = process.argv.includes('--down')
    if (isDown) {
      await rollbackMigration()
    } else {
      await runMigrations()
    }

    await mongoose.disconnect()
    logger.info('✅ Hoàn tất thao tác migration CLI')
    process.exit(0)
  } catch (err) {
    logger.error({ err }, '❌ Lỗi khi thực thi migration CLI')
    process.exit(1)
  }
}

main()
