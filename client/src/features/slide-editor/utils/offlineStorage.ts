import type { Lecture } from '@/lib/types'

const OFFLINE_DRAFT_PREFIX = 'abslider_offline_draft_'

export interface OfflineDraft {
  lecture: Lecture
  savedAt: string
}

/**
 * Lưu bản nháp bài giảng vào localStorage khi mất kết nối mạng
 */
export const saveOfflineDraft = (lecture: Lecture): void => {
  if (!lecture?._id) return
  try {
    const draft: OfflineDraft = {
      lecture,
      savedAt: new Date().toISOString()
    }
    localStorage.setItem(
      `${OFFLINE_DRAFT_PREFIX}${lecture._id}`,
      JSON.stringify(draft)
    )
  } catch (error) {
    console.warn('Không thể lưu bản nháp offline vào localStorage:', error)
  }
}

/**
 * Lấy bản nháp bài giảng offline từ localStorage
 */
export const getOfflineDraft = (lectureId: string): OfflineDraft | null => {
  if (!lectureId) return null
  try {
    const raw = localStorage.getItem(`${OFFLINE_DRAFT_PREFIX}${lectureId}`)
    if (!raw) return null
    return JSON.parse(raw) as OfflineDraft
  } catch (error) {
    console.warn('Lỗi đọc bản nháp offline từ localStorage:', error)
    return null
  }
}

/**
 * Xóa bản nháp offline sau khi đã đồng bộ thành công lên server
 */
export const clearOfflineDraft = (lectureId: string): void => {
  if (!lectureId) return
  try {
    localStorage.removeItem(`${OFFLINE_DRAFT_PREFIX}${lectureId}`)
  } catch (error) {
    console.warn('Lỗi xóa bản nháp offline từ localStorage:', error)
  }
}

/**
 * Kiểm tra xem có bản nháp offline chưa đồng bộ không
 */
export const hasOfflineDraft = (lectureId: string): boolean => {
  if (!lectureId) return false
  return Boolean(localStorage.getItem(`${OFFLINE_DRAFT_PREFIX}${lectureId}`))
}
