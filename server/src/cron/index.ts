import { initTrashCleanupCron } from './trashCleanup.cron'
import { initLockedUserCleanupCron } from './lockedUserCleanup.cron'

export const initCronJobs = () => {
  return [initTrashCleanupCron(), initLockedUserCleanupCron()]
}
