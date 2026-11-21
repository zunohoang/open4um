import { isAxiosError } from 'axios'

export function requestError(error: unknown, fallback: string, ai = false) {
  if (!isAxiosError(error))
    return error instanceof Error ? error.message : fallback
  const message = error.response?.data?.message
  if (typeof message === 'string' && message) return message
  if (ai && error.response?.status === 504)
    return 'AI phản hồi quá lâu. Vui lòng thử lại; yêu cầu này không bị tính credit.'
  if (!error.response)
    return 'Không thể kết nối mạng. Vui lòng kiểm tra đường truyền và thử lại.'
  return fallback
}
