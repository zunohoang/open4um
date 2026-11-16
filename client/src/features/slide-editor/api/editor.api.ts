import { apiClient } from '@/lib/api'
import type { Lecture, Slide } from '@/lib/types'
import { buildAutosavePayload } from '../utils/autosave'

export interface AiChatPayload {
  message: string
  slideId?: string
  currentSlide?: Slide
  selectedCompId?: string
  sourceMaterial?: string
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
}

export interface AiSlideProposalData {
  id?: string
  action: 'CREATE_SLIDE' | 'UPDATE_SLIDE'
  targetSlideIndex: number
  targetSlideId?: string
  proposedSlide: Slide
  summary?: string
}

export interface AiChatResponseData {
  reply: string
  action:
    | 'UPDATE_CURRENT_SLIDE'
    | 'UPDATE_SLIDE'
    | 'CREATE_SLIDE'
    | 'BATCH_CHANGES'
    | 'CHAT_ONLY'
  targetSlideIndex?: number
  targetSlideId?: string
  proposedSlide?: Slide
  proposals?: AiSlideProposalData[]
  updatedSummary?: string
  aiChatHistory?: Array<Record<string, unknown>>
  creditSpent: number
  creditBalance: number
}

export const editorApi = {
  // Trả URL ảnh do server phục vụ (SRS UC011 bước 5)
  uploadImage: async (dataUrl: string) => {
    const { key } = (
      await apiClient.post<{ data: { key: string } }>('/lectures/images', {
        dataUrl
      })
    ).data.data
    return `${import.meta.env.VITE_API_BASE_URL}/media/${key}`
  },

  get: async (id: string) =>
    (await apiClient.get<{ data: Lecture }>(`/lectures/${id}`)).data.data,

  autosave: async (lecture: Lecture, previous?: Lecture) =>
    (
      await apiClient.patch<{ data: { savedAt: string } }>(
        `/lectures/${lecture._id}/autosave`,
        buildAutosavePayload(lecture, previous),
        { params: { view: 'receipt' } }
      )
    ).data.data,

  aiChat: async (
    id: string,
    payload: AiChatPayload
  ): Promise<AiChatResponseData> =>
    (
      await apiClient.post<{ data: AiChatResponseData }>(
        `/lectures/${id}/ai-chat`,
        payload
      )
    ).data.data
}
