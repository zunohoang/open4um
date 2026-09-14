import { isCorsOriginAllowed } from '@/config/cors'

describe('CORS origin allowlist', () => {
  it('cho phép request không có Origin cho health check và server-to-server', () => {
    expect(isCorsOriginAllowed(undefined)).toBe(true)
  })

  it('cho phép origin đã cấu hình', () => {
    expect(isCorsOriginAllowed('http://localhost:5173')).toBe(true)
  })

  it('từ chối origin không nằm trong allowlist', () => {
    expect(isCorsOriginAllowed('https://untrusted.example')).toBe(false)
  })
})
