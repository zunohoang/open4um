import { apiClient } from '@/lib/api'
import type { Lecture, Slide } from '@/lib/types'

export const editorApi = {
  get: async (id: string) =>
    (await apiClient.get<{ data: Lecture }>(`/lectures/${id}`)).data.data,
  autosave: async (lecture: Lecture) =>
    (
      await apiClient.patch<{ data: { lecture: Lecture } }>(
        `/lectures/${lecture._id}/autosave`,
        {
          title: lecture.title,
          pattern: lecture.pattern,
          slides: lecture.slides
        }
      )
    ).data.data,
  operation: async (id: string, operation: object) =>
    (
      await apiClient.post<{ data: Lecture }>(
        `/lectures/${id}/slides`,
        operation
      )
    ).data.data,
  aiEdit: async (id: string, slide: Slide, instruction: string) =>
    (
      await apiClient.post<{ data: { lecture: Lecture } }>(
        `/lectures/${id}/ai-edit`,
        { slideId: slide.id, instruction }
      )
    ).data.data.lecture,
  updateSlide: async (
    lectureId: string,
    slideId: string,
    patch: Partial<Slide>
  ) =>
    (
      await apiClient.post<{ data: Lecture }>(`/lectures/${lectureId}/slides`, {
        operation: 'update',
        slideId,
        patch
      })
    ).data.data
}
