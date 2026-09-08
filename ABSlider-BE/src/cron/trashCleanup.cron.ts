import cron from 'node-cron'
import { logger } from '@/lib/logger'
import { cleanupExpiredTrash } from '@/services/lecture.service'

/**
 * Khởi tạo CronJob tự động dọn dẹp các bài giảng trong thùng rác đã quá hạn 30 ngày.
 * Lịch chạy: Mỗi ngày lúc 00:00 (nửa đêm).
 */
export const initTrashCleanupCron = () => {
  // Chạy ngay 1 lần khi server khởi động để dọn dẹp các mục tồn đọng
  cleanupExpiredTrash().catch((err) => {
    logger.error(
      { err },
      '❌ [CronJob] Lỗi dọn dẹp thùng rác khi khởi động server'
    )
  })

  // Đặt lịch chạy định kỳ mỗi ngày lúc 00:00:00 ('0 0 * * *')
  cron.schedule('0 0 * * *', async () => {
    logger.info(
      '⏳ [CronJob] Bắt đầu quét và xóa vĩnh viễn bài giảng quá hạn 30 ngày trong thùng rác...'
    )
    try {
      const deletedCount = await cleanupExpiredTrash()
      logger.info(
        `✅ [CronJob] Quét thùng rác hoàn tất. Đã xóa ${deletedCount} bài giảng quá hạn.`
      )
    } catch (err) {
      logger.error({ err }, '❌ [CronJob] Lỗi dọn dẹp thùng rác định kỳ')
    }
  })

  logger.info(
    '⏰ [CronJob] Đã kích hoạt lịch trình dọn dẹp thùng rác 30 ngày (00:00 hàng ngày)'
  )
}
