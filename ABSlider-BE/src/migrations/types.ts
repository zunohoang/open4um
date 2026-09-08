import type { ClientSession, mongo } from 'mongoose'

export interface MigrationContext {
  db: mongo.Db
  session?: ClientSession
}

export interface Migration {
  id: string
  up(ctx: MigrationContext): Promise<void>
  down?(ctx: MigrationContext): Promise<void>
}
