import { apiClient } from '@/lib/api'
import type { Folder, Lecture, Paginated } from '@/lib/types'

export const lectureApi = {
  list: async (params: Record<string, string | undefined>) =>
    (await apiClient.get<{ data: Paginated<Lecture> }>('/lectures', { params }))
      .data.data,

  trash: async () => {
    const res = (
      await apiClient.get<{ data: Lecture[] | Paginated<Lecture> }>(
        '/lectures/trash'
      )
    ).data.data
    return Array.isArray(res) ? res : res.items || []
  },

  folders: async () =>
    (await apiClient.get<{ data: Folder[] }>('/folders')).data.data,

  createFolder: async (name: string) =>
    (await apiClient.post<{ data: Folder }>('/folders', { name })).data.data,

  updateFolder: async (id: string, name: string) =>
    (await apiClient.patch<{ data: Folder }>(`/folders/${id}`, { name })).data
      .data,

  deleteFolder: async (id: string) => apiClient.delete(`/folders/${id}`),

  update: async (
    id: string,
    payload: { title?: string; folderId?: string | null }
  ) =>
    (await apiClient.patch<{ data: Lecture }>(`/lectures/${id}`, payload)).data
      .data,

  duplicate: async (id: string) =>
    (await apiClient.post<{ data: Lecture }>(`/lectures/${id}/duplicate`)).data
      .data,

  // Soft delete: Chuyển bài giảng vào thùng rác (đếm ngược 30 ngày)
  moveToTrash: async (id: string) => apiClient.delete(`/lectures/${id}`),
  remove: async (id: string) => apiClient.delete(`/lectures/${id}`),

  // Khôi phục bài giảng về trạng thái hoạt động bình thường
  restore: async (id: string) => apiClient.post(`/lectures/${id}/restore`),

  createBlank: async (title: string) =>
    (await apiClient.post<{ data: Lecture }>('/lectures/blank', { title })).data
      .data,

  export: async (id: string) =>
    (
      await apiClient.post<{
        data: {
          downloadUrl: string | null
          data: Record<string, unknown>
        }
      }>(`/lectures/${id}/export`)
    ).data.data
}
