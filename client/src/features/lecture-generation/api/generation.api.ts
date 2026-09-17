import { apiClient } from '@/lib/api'
import type { Lecture, Outline } from '@/lib/types'

export interface OutlineResult {
  lecture?: Lecture
  outline: Outline
  creditSpent: number
  creditBalance: number
}

export type CreatedLectureResult = Lecture & {
  creditSpent?: number
  creditBalance?: number
}

export const generationApi = {
  outline: async (
    prompt: string,
    options?: {
      feedback?: string
      currentOutline?: Outline
      lectureId?: string
    }
  ): Promise<OutlineResult> =>
    (
      await apiClient.post<{ data: OutlineResult }>(
        '/lectures/generate-outline',
        { prompt, ...options }
      )
    ).data.data,
  create: async (data: {
    lectureId?: string
    title: string
    prompt: string
    outline: Outline
  }): Promise<CreatedLectureResult> =>
    (await apiClient.post<{ data: CreatedLectureResult }>('/lectures', data))
      .data.data
}
