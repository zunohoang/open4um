export type Role = 'user' | 'admin'

export interface AccessTokenPayload {
  id: string
  role: Role
  type: 'access'
}

export interface RefreshTokenPayload {
  id: string
  role: Role
  type: 'refresh'
  jti: string
}
