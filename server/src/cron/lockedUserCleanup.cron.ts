import cron from 'node-cron'
import { logger } from '@/lib/logger'
import { cleanupExpiredLockedUsers } from '@/services/admin.service'

/**
 * Khởi tạo CronJob tự động xóa vĩnh viễn các tài khoản bị khóa quá hạn 30 ngày.
 * Lịch chạy: Mỗi ngày lúc 00:00 (nửa đêm).
 */
export const initLockedUserCleanupCron = () => {
  // Chạy ngay 1 lần khi server khởi động để dọn dẹp các tài khoản đã quá hạn 30 ngày
  cleanupExpiredLockedUsers().catch((err) => {
    logger.error(
      { err },
      '❌ [CronJob] Lỗi dọn dẹp tài khoản quá hạn khi khởi động server'
    )
  })

  // Đặt lịch chạy định kỳ mỗi ngày lúc 00:00:00 ('0 0 * * *')
  cron.schedule('0 0 * * *', async () => {
    logger.info(
      '⏳ [CronJob] Bắt đầu quét và xóa vĩnh viễn tài khoản bị khóa quá 30 ngày...'
    )
    try {
      const deletedCount = await cleanupExpiredLockedUsers()
      if (deletedCount > 0) {
        logger.info(
          `✅ [CronJob] Đã xóa vĩnh viễn ${deletedCount} tài khoản bị khóa quá 30 ngày cùng bài giảng liên quan.`
        )
      }
    } catch (err) {
      logger.error(
        { err },
        '❌ [CronJob] Lỗi dọn dẹp tài khoản bị khóa định kỳ'
      )
    }
  })

  logger.info(
    '⏰ [CronJob] Đã kích hoạt lịch trình tự động xóa tài khoản bị khóa 30 ngày (00:00 hàng ngày)'
  )
}
