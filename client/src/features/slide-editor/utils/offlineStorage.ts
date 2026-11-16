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
    const offlineLecture = { ...lecture }
    delete offlineLecture.aiChatHistory
    const draft: OfflineDraft = {
      lecture: offlineLecture,
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
    const draft = JSON.parse(raw) as OfflineDraft
    if (draft?.lecture?._id !== lectureId) return null
    // Keep old slide drafts, but never restore their cached chat.
    if ('aiChatHistory' in draft.lecture) {
      delete draft.lecture.aiChatHistory
      try {
        localStorage.setItem(
          `${OFFLINE_DRAFT_PREFIX}${lectureId}`,
          JSON.stringify(draft)
        )
      } catch {
        // The draft remains usable if storage cannot be rewritten.
      }
    }
    return draft
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

export const clearLocalChatHistory = (): void => {
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index)
      if (key?.startsWith('abslider_chat_')) {
        localStorage.removeItem(key)
      } else if (key?.startsWith(OFFLINE_DRAFT_PREFIX)) {
        getOfflineDraft(key.slice(OFFLINE_DRAFT_PREFIX.length))
      }
    }
  } catch {
    // Editing must work even when browser storage is unavailable.
  }
}
