import { apiClient } from '@/lib/api'
import type { Lecture, Slide } from '@/lib/types'

export interface AiChatPayload {
  message: string
  slideId?: string
  selectedCompId?: string
  sourceMaterial?: string
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
}

export interface AiSlideProposalData {
  id?: string
  action: 'CREATE_SLIDE' | 'UPDATE_SLIDE'
  targetSlideIndex: number
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
  proposedSlide?: Slide
  proposals?: AiSlideProposalData[]
  updatedSummary?: string
  creditSpent: number
  creditBalance: number
}

export const editorApi = {
  get: async (id: string) =>
    (await apiClient.get<{ data: Lecture }>(`/lectures/${id}`)).data.data,

  autosave: async (lecture: Lecture) =>
    (
      await apiClient.patch<{ data: { lecture: Lecture } }>(
        `/lectures/${lecture._id}/autosave`,
        {
          title: lecture.title,
          slides: lecture.slides,
          theme: lecture.theme,
          contextSummary: lecture.contextSummary,
          sourceMaterial: lecture.sourceMaterial
        }
      )
    ).data.data,

  aiEdit: async (id: string, slide: Slide, instruction: string) =>
    (
      await apiClient.post<{ data: { lecture: Lecture } }>(
        `/lectures/${id}/ai-edit`,
        { slideId: slide.id, instruction }
      )
    ).data.data.lecture,

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
