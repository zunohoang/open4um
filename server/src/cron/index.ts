import { initLockedUserCleanupCron } from './lockedUserCleanup.cron'

export const initCronJobs = () => {
  // Thùng rác 30 ngày do TTL index deletedAt_ttl_30d của MongoDB tự dọn (lecture.model.ts)
  return [initLockedUserCleanupCron()]
}
