import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/features/auth/store/auth.store'

interface CustomRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

interface FailedRequestQueueItem {
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
  config: CustomRequestConfig
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
})

// Gắn accessToken vào mọi request đi ra
apiClient.interceptors.request.use((config) => {
  const token =
    useAuthStore.getState().accessToken || localStorage.getItem('accessToken')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Hàng đợi lưu các request bị 401 trong khi đang gọi refresh token
let isRefreshing = false
let failedQueue: FailedRequestQueueItem[] = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else if (token) {
      if (prom.config.headers) {
        prom.config.headers.Authorization = `Bearer ${token}`
      }
      prom.resolve(apiClient(prom.config))
    }
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string }>) => {
    const originalRequest = error.config as CustomRequestConfig | undefined

    // Nếu không phải lỗi 401 hoặc không có config của request gốc -> reject
    if (!error.response || error.response.status !== 401 || !originalRequest) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Không thể kết nối đến máy chủ'
      console.error('❌ Lỗi gọi API:', message)
      return Promise.reject(error)
    }

    const requestUrl = originalRequest.url || ''
    const isAuthRoute =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/refresh')

    // Nếu là route auth hoặc request này đã từng được retry 1 lần mà vẫn 401
    if (isAuthRoute || originalRequest._retry) {
      if (requestUrl.includes('/auth/refresh')) {
        // Refresh token cũng hết hạn / bị thu hồi -> xóa toàn bộ session
        useAuthStore.getState().clearSession()
      }
      const message =
        error.response?.data?.message ||
        error.message ||
        'Phiên làm việc đã kết thúc'
      console.error('❌ Lỗi xác thực:', message)
      return Promise.reject(error)
    }

    const refreshToken =
      useAuthStore.getState().refreshToken ||
      localStorage.getItem('refreshToken')

    // Không có refresh token -> không thể refresh, hủy session
    if (!refreshToken) {
      useAuthStore.getState().clearSession()
      return Promise.reject(error)
    }

    // Nếu đang có 1 tiến trình refresh chạy dở, đẩy request này vào hàng đợi chờ kết quả
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject, config: originalRequest })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      // Dùng axios riêng biệt gọi refresh để tránh loop interceptor
      const baseURL = import.meta.env.VITE_API_BASE_URL
      const refreshResponse = await axios.post<{
        data: { accessToken: string }
      }>(`${baseURL}/auth/refresh`, { refreshToken })

      const newAccessToken = refreshResponse.data?.data?.accessToken
      if (!newAccessToken) {
        throw new Error('Máy chủ không trả về access token mới')
      }

      // Cập nhật access token mới vào Zustand store và localStorage
      useAuthStore.getState().setAccessToken(newAccessToken)

      // Xử lý và gửi lại toàn bộ request trong hàng đợi
      processQueue(null, newAccessToken)

      // Gửi lại request ban đầu với token mới
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      }
      return apiClient(originalRequest)
    } catch (refreshError) {
      // Nếu refresh thất bại (hết hạn, bị blacklist Redis,...)
      processQueue(refreshError, null)
      useAuthStore.getState().clearSession()
      console.error(
        '❌ Phiên làm việc đã hết hạn hoặc bị thu hồi, vui lòng đăng nhập lại'
      )
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)
