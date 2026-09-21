import { z } from 'zod'

export const DEFAULT_ADMIN_EMAIL = 'admin@abslider.com'
export const DEFAULT_ADMIN_PASSWORD = 'admin123456'

const emptyStringToUndefined = (value: unknown) => {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

const optionalAdminEmail = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase())
    .optional()
)

const optionalAdminPassword = z.preprocess(
  emptyStringToUndefined,
  z.string().optional()
)

const commaSeparatedOrigins = z
  .string()
  .default('http://localhost:5173')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  )
  .pipe(z.array(z.string().url()).min(1))

const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.string().url().optional()
)

const optionalReleaseSha = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .regex(
      /^[0-9a-f]{40}$/,
      'RELEASE_SHA must be a 40-character lowercase Git SHA'
    )
    .optional()
)

const optionalReleaseEnvironment = z.preprocess(
  emptyStringToUndefined,
  z.enum(['develop', 'production']).optional()
)

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')

const isExactOrigin = (value: string) => {
  const url = new URL(value)
  return url.origin === value && url.username === '' && url.password === ''
}

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().default(4000),
    HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    RELEASE_SHA: optionalReleaseSha,
    RELEASE_ENVIRONMENT: optionalReleaseEnvironment,
    CORS_ALLOWED_ORIGINS: commaSeparatedOrigins,
    MONGO_URI: z.string().url(),
    REDIS_URL: z.string().url(),
    JWT_SECRET: z.string().min(16),
    GEMINI_API_KEY: z.string(),
    MINIO_ENDPOINT: z.string(),
    MINIO_USE_SSL: booleanString,
    MINIO_PUBLIC_ENDPOINT: optionalUrl,
    MINIO_ACCESS_KEY: z.string(),
    MINIO_SECRET_KEY: z.string(),
    ADMIN_EMAIL: optionalAdminEmail,
    ADMIN_PASSWORD: optionalAdminPassword,
    ADMIN_NAME: z.preprocess(
      emptyStringToUndefined,
      z.string().trim().min(1).default('Admin ABSlider')
    ),
    ADMIN_CREDIT_BALANCE: z.preprocess(
      emptyStringToUndefined,
      z.coerce.number().int().nonnegative().default(1000)
    ),
    RESEND_API_KEY: z.string(),
    RESEND_FROM_EMAIL: z.string(),
    ENABLE_EMAIL_VERIFICATION: z
      .string()
      .default('true')
      .transform((val) => val !== 'false')
  })
  .superRefine((values, context) => {
    for (const origin of values.CORS_ALLOWED_ORIGINS) {
      if (!isExactOrigin(origin)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ALLOWED_ORIGINS'],
          message: `CORS origin must not contain credentials, path, query or fragment: ${origin}`
        })
      }
    }

    if (values.NODE_ENV !== 'production') return

    if (!values.RELEASE_SHA) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RELEASE_SHA'],
        message: 'RELEASE_SHA is required in production'
      })
    }

    if (!values.RELEASE_ENVIRONMENT) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RELEASE_ENVIRONMENT'],
        message: 'RELEASE_ENVIRONMENT is required in production'
      })
    }

    for (const origin of values.CORS_ALLOWED_ORIGINS) {
      const url = new URL(origin)
      if (url.protocol !== 'https:' || url.hostname === 'localhost') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ALLOWED_ORIGINS'],
          message:
            'Production CORS origins must use HTTPS and must not use localhost'
        })
      }
    }

    if (!values.MINIO_PUBLIC_ENDPOINT) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MINIO_PUBLIC_ENDPOINT'],
        message: 'MINIO_PUBLIC_ENDPOINT is required in production'
      })
    } else {
      const publicMinioUrl = new URL(values.MINIO_PUBLIC_ENDPOINT)
      if (
        publicMinioUrl.protocol !== 'https:' ||
        !isExactOrigin(values.MINIO_PUBLIC_ENDPOINT)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MINIO_PUBLIC_ENDPOINT'],
          message: 'MINIO_PUBLIC_ENDPOINT must be an HTTPS origin in production'
        })
      }
    }

    if (!values.ADMIN_EMAIL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_EMAIL'],
        message: 'ADMIN_EMAIL is required in production'
      })
    } else if (values.ADMIN_EMAIL === DEFAULT_ADMIN_EMAIL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_EMAIL'],
        message: 'Default ADMIN_EMAIL is forbidden in production'
      })
    }

    if (!values.ADMIN_PASSWORD) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_PASSWORD'],
        message: 'ADMIN_PASSWORD is required in production'
      })
      return
    }

    const strongPassword =
      values.ADMIN_PASSWORD.length >= 12 &&
      /[a-z]/.test(values.ADMIN_PASSWORD) &&
      /[A-Z]/.test(values.ADMIN_PASSWORD) &&
      /[0-9]/.test(values.ADMIN_PASSWORD) &&
      /[^A-Za-z0-9]/.test(values.ADMIN_PASSWORD)

    if (values.ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD || !strongPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_PASSWORD'],
        message:
          'ADMIN_PASSWORD must contain at least 12 characters, including lowercase, uppercase, number and special character'
      })
    }
  })

export const parseEnv = (values: Record<string, unknown>) => {
  return envSchema.parse(values)
}

export const env = parseEnv(process.env)
