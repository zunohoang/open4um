export type Role = 'user' | 'admin'

export interface AccessTokenPayload {
  id: string
  role: Role
  type: 'access'
  sessionId?: string
  tokenVersion?: number
}

export interface RefreshTokenPayload {
  id: string
  role: Role
  type: 'refresh'
  jti: string
  tokenVersion?: number
}
