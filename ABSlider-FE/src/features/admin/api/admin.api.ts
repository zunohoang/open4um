import { apiClient } from '@/lib/api'
import type {
  AdminUser,
  AiUsageLog,
  CreditConfig,
  Paginated
} from '@/lib/types'

export interface ListUsersParams {
  page?: number
  limit?: number
  search?: string
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  creditBalance?: number
}

export interface UpdateUserPayload {
  creditBalance: number
}

export interface ListAiUsageParams {
  page?: number
  limit?: number
  userId?: string
  from?: string
  to?: string
}

export interface UpdateCreditConfigPayload {
  pricePerSlide?: number
  pricePerAiEdit?: number
  signupBonus?: number
}

export const adminApi = {
  getUsers: async (params?: ListUsersParams) =>
    (
      await apiClient.get<{ data: Paginated<AdminUser> }>('/admin/users', {
        params
      })
    ).data.data,

  createUser: async (payload: CreateUserPayload) =>
    (await apiClient.post<{ data: AdminUser }>('/admin/users', payload)).data
      .data,

  updateUser: async (id: string, payload: UpdateUserPayload) =>
    (await apiClient.patch<{ data: AdminUser }>(`/admin/users/${id}`, payload))
      .data.data,

  lockUser: async (id: string) =>
    (await apiClient.patch<{ data: AdminUser }>(`/admin/users/${id}/lock`)).data
      .data,

  restoreUser: async (id: string) =>
    (await apiClient.patch<{ data: AdminUser }>(`/admin/users/${id}/restore`))
      .data.data,

  getAiUsage: async (params?: ListAiUsageParams) =>
    (
      await apiClient.get<{ data: Paginated<AiUsageLog> }>('/admin/ai-usage', {
        params
      })
    ).data.data,

  getCreditConfig: async () =>
    (await apiClient.get<{ data: CreditConfig }>('/admin/credit-config')).data
      .data,

  updateCreditConfig: async (payload: UpdateCreditConfigPayload) =>
    (
      await apiClient.patch<{ data: CreditConfig }>(
        '/admin/credit-config',
        payload
      )
    ).data.data
}
