import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import { logger } from '@/lib/logger'
import type { Migration } from '@/migrations/types'

const MIGRATIONS_COLLECTION = '_migrations'

export const getMigrationFiles = (): string[] => {
  const dir = __dirname
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((file) => {
      const isCode = file.endsWith('.ts') || file.endsWith('.js')
      const isSpecial =
        file.startsWith('runner.') ||
        file.startsWith('cli.') ||
        file.startsWith('types.') ||
        file.endsWith('.d.ts') ||
        file.endsWith('.map')
      return isCode && !isSpecial
    })
    .sort()
}

export const runMigrations = async (): Promise<void> => {
  const db = mongoose.connection.db
  if (!db) {
    throw new Error('Database chưa kết nối khi chạy migration')
  }

  const migrationFiles = getMigrationFiles()
  const collection = db.collection(MIGRATIONS_COLLECTION)

  const appliedDocs = await collection.find({}).toArray()
  const appliedIds = new Set(appliedDocs.map((doc) => doc.id))

  let count = 0
  for (const file of migrationFiles) {
    const filePath = path.join(__dirname, file)
    const mod = require(filePath)
    const migration: Migration = mod.default || mod

    if (!migration || !migration.id || typeof migration.up !== 'function') {
      logger.warn({ file }, '⚠️ Bỏ qua file migration không hợp lệ')
      continue
    }

    if (!appliedIds.has(migration.id)) {
      logger.info({ id: migration.id }, '🚀 Đang thực thi migration...')
      await migration.up({ db })
      await collection.insertOne({
        id: migration.id,
        appliedAt: new Date()
      })
      logger.info({ id: migration.id }, '✅ Migration hoàn tất')
      count++
    }
  }

  if (count === 0) {
    logger.info('✅ Đã kiểm tra migrations (không có migration nào cần chạy)')
  } else {
    logger.info(`✅ Đã thực thi thành công ${count} migration(s)`)
  }
}

export const rollbackMigration = async (): Promise<void> => {
  const db = mongoose.connection.db
  if (!db) {
    throw new Error('Database chưa kết nối khi rollback migration')
  }

  const collection = db.collection(MIGRATIONS_COLLECTION)
  const lastApplied = await collection
    .find({})
    .sort({ appliedAt: -1 })
    .limit(1)
    .toArray()

  if (lastApplied.length === 0) {
    logger.info('ℹ️ Không có migration nào để rollback')
    return
  }

  const targetId = lastApplied[0].id
  const migrationFiles = getMigrationFiles()

  for (const file of migrationFiles) {
    const filePath = path.join(__dirname, file)
    const mod = require(filePath)
    const migration: Migration = mod.default || mod

    if (migration?.id === targetId) {
      if (typeof migration.down === 'function') {
        logger.info({ id: targetId }, '⏪ Đang rollback migration...')
        await migration.down({ db })
      } else {
        logger.warn(
          { id: targetId },
          '⚠️ Migration không có hàm down(), bỏ qua phần down()'
        )
      }
      await collection.deleteOne({ id: targetId })
      logger.info({ id: targetId }, '✅ Rollback migration hoàn tất')
      return
    }
  }

  await collection.deleteOne({ id: targetId })
  logger.info({ id: targetId }, '✅ Đã xóa bản ghi migration khỏi DB')
}
