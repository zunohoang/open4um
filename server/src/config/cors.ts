import type { CorsOptions } from 'cors'
import { env } from '@/config/env'

export const isCorsOriginAllowed = (origin: string | undefined) => {
  return !origin || env.CORS_ALLOWED_ORIGINS.includes(origin)
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    callback(null, isCorsOriginAllowed(origin))
  }
}
