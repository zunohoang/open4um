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
    },
    signal?: AbortSignal
  ): Promise<OutlineResult> =>
    (
      await apiClient.post<{ data: OutlineResult }>(
        '/lectures/generate-outline',
        { prompt, ...options },
        { signal }
      )
    ).data.data,
  create: async (
    data: {
      lectureId?: string
      title: string
      prompt: string
      theme?: string
      outline: Outline
    },
    signal?: AbortSignal
  ): Promise<CreatedLectureResult> =>
    (
      await apiClient.post<{ data: CreatedLectureResult }>('/lectures', data, {
        signal
      })
    ).data.data
}
