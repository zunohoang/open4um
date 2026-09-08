import { apiClient } from '@/lib/api'
import type { Lecture, Outline } from '@/lib/types'

export interface OutlineResult {
  outline: Outline
  creditSpent: number
  creditBalance: number
}

export const generationApi = {
  outline: async (prompt: string): Promise<OutlineResult> =>
    (
      await apiClient.post<{ data: OutlineResult }>(
        '/lectures/generate-outline',
        { prompt }
      )
    ).data.data,
  create: async (data: {
    title: string
    prompt: string
    pattern: string
    outline: Outline
  }) => (await apiClient.post<{ data: Lecture }>('/lectures', data)).data.data
}
