import { apiClient } from '@/lib/api'
import type { User } from '@/lib/types'

export interface AuthSession {
  user: User
  accessToken: string
  refreshToken: string
}

export const authApi = {
  login: async (data: { email: string; password: string }) =>
    (await apiClient.post<{ data: AuthSession }>('/auth/login', data)).data
      .data,
  sendRegisterOtp: async (data: { email: string }) =>
    (await apiClient.post<{ message: string }>('/auth/send-register-otp', data))
      .data,
  register: async (data: {
    name: string
    email: string
    password: string
    otp?: string
  }) =>
    (await apiClient.post<{ data: AuthSession }>('/auth/register', data)).data
      .data,
  forgotPassword: async (data: { email: string }) =>
    (await apiClient.post<{ message: string }>('/auth/forgot-password', data))
      .data,
  resetPassword: async (data: {
    email: string
    otp: string
    password: string
  }) =>
    (await apiClient.post<{ message: string }>('/auth/reset-password', data))
      .data,
  profile: async () =>
    (await apiClient.get<{ data: User }>('/auth/me')).data.data,
  refresh: async (refreshToken: string) =>
    (
      await apiClient.post<{ data: { accessToken: string } }>('/auth/refresh', {
        refreshToken
      })
    ).data.data,
  logout: async (refreshToken: string) =>
    apiClient.post('/auth/logout', { refreshToken })
}
