export function mediaUrl(value: string): string {
  return value.startsWith('/api/v1/media/')
    ? (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '') +
        value.slice('/api/v1'.length)
    : value
}
