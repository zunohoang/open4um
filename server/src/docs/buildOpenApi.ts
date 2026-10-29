import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3
} from '@asteasolutions/zod-to-openapi'
import * as auth from '../validators/auth.validator'
import * as lecture from '../validators/lecture.validator'
import * as folder from '../validators/folder.validator'
import * as admin from '../validators/admin.validator'

extendZodWithOpenApi(z)
type Method = 'get' | 'post' | 'patch' | 'delete'
type Entry = {
  method: Method
  path: string
  summary: string
  role: 'public' | 'authenticated' | 'user' | 'admin'
  body?: z.ZodTypeAny
  output?: z.ZodTypeAny
  code?: number
  query?: z.AnyZodObject
  errors?: number[]
  note?: string
}

export function actualOperations() {
  const prefixes: Record<string, string> = {
    health: '',
    auth: '/auth',
    lecture: '/lectures',
    folder: '/folders',
    admin: '/admin'
  }
  return Object.entries(prefixes)
    .flatMap(([name, prefix]) => {
      const source = readFileSync(
        resolve(__dirname, `../routes/${name}.routes.ts`),
        'utf8'
      )
      return [
        ...source.matchAll(/\w+Router\.(get|post|patch|delete)\(\s*'([^']+)'/g)
      ].map(
        (match) =>
          `${match[1]} ${(prefix + match[2]).replace(/:(\w+)/g, '{$1}').replace(/\/$/, '') || '/'}`
      )
    })
    .sort()
}

export function buildOpenApi() {
  const registry = new OpenAPIRegistry()
  registry.registerComponent('securitySchemes', 'BearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'Use the accessToken from login. Tokens and credentials are never pre-filled or persisted by this UI.'
  })
  const objectId = z
    .string()
    .min(1)
    .describe(
      'MongoDB document identifier. Unknown valid IDs return 404; malformed IDs may produce a server error.'
    )
  const message = registry.register(
    'Message',
    z.object({ message: z.string() })
  )
  const error = registry.register(
    'ErrorResponse',
    z.object({ success: z.literal(false), message: z.string() })
  )
  const publicUser = registry.register(
    'PublicUser',
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      role: z.enum(['admin', 'user']),
      status: z.string(),
      creditBalance: z.number(),
      avatar: z.string().nullable()
    })
  )
  const adminUser = registry.register(
    'AdminUser',
    z
      .object({
        _id: z.string(),
        name: z.string(),
        email: z.string().email(),
        role: z.enum(['admin', 'user']),
        creditBalance: z.number(),
        status: z.string().optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional()
      })
      .passthrough()
  )
  const slide = registry.register(
    'Slide',
    z
      .object({
        id: z.string(),
        title: z.string().optional(),
        bullets: z.array(z.string()).optional(),
        components: z.array(z.record(z.unknown())).optional()
      })
      .passthrough()
  )
  const deck = registry.register(
    'Lecture',
    z
      .object({
        _id: z.string(),
        userId: z.string(),
        title: z.string(),
        slides: z.array(slide),
        folderId: z.string().nullable().optional(),
        deletedAt: z.string().nullable().optional(),
        theme: z.string().optional()
      })
      .passthrough()
  )
  const folderResult = registry.register(
    'Folder',
    z
      .object({ _id: z.string(), userId: z.string(), name: z.string() })
      .passthrough()
  )
  const usage = registry.register(
    'AiUsage',
    z
      .object({
        _id: z.string(),
        userId: z.union([z.string(), adminUser.partial(), z.null()]),
        prompt: z.string(),
        slideCount: z.number(),
        creditSpent: z.number(),
        createdAt: z.string()
      })
      .passthrough()
  )
  const pagination = z
    .object({
      page: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
      search: z.string().optional()
    })
    .describe(
      'Pagination is normalized by the controller; invalid values are not all rejected. Defaults: page 1, limit 20, maximum limit 100.'
    )
  const dateRange = z
    .object({ from: z.string().optional(), to: z.string().optional() })
    .describe(
      'Calendar dates in YYYY-MM-DD. Reversed or invalid ranges return 422.'
    )
  const paged = (item: z.ZodTypeAny) =>
    z.object({
      items: z.array(item),
      total: z.number(),
      page: z.number(),
      limit: z.number()
    })
  const release = registry.register(
    'Release',
    z.object({
      sha: z.string().nullable(),
      environment: z.string().nullable()
    })
  )
  let creditRequest: z.ZodTypeAny = admin.updateCreditConfigSchema
  while (creditRequest instanceof z.ZodEffects)
    creditRequest = creditRequest.innerType()
  const creditFields = Object.keys((creditRequest as z.AnyZodObject).shape)
  const creditResult = registry.register(
    'CreditConfig',
    z
      .object(
        Object.fromEntries(
          creditFields.map((key) => [key, z.number().int().positive()])
        )
      )
      .passthrough()
  )
  const health = z.object({ status: z.string(), release }).passthrough()
  const generation = z
    .object({ creditSpent: z.number(), creditBalance: z.number() })
    .passthrough()
  const outline = z.object({
    title: z.string(),
    sections: z.array(
      z.object({ heading: z.string(), bullets: z.array(z.string()) })
    )
  })
  const dashboard = registry.register(
    'Dashboard',
    z.object({
      from: z.string(),
      to: z.string(),
      totals: z.object({
        users: z.number(),
        lectures: z.number(),
        aiUsages: z.number(),
        aiSlides: z.number(),
        creditsSpent: z.number()
      }),
      allTime: z.object({
        users: z.number(),
        lectures: z.number(),
        aiUsages: z.number(),
        aiSlides: z.number(),
        creditsSpent: z.number()
      }),
      series: z.array(
        z.object({
          date: z.string(),
          users: z.number(),
          lectures: z.number(),
          creditsSpent: z.number()
        })
      ),
      recentActivities: z.array(usage)
    })
  )
  const entries: Entry[] = []
  const add = (
    method: Method,
    path: string,
    summary: string,
    role: Entry['role'],
    extra: Partial<Entry> = {}
  ) => entries.push({ method, path, summary, role, ...extra })
  for (const path of ['/health', '/health/live'])
    add('get', path, 'Liveness and release identity', 'public', {
      output: health
    })
  add('get', '/health/ready', 'Readiness of runtime dependencies', 'public', {
    output: health,
    errors: [503]
  })
  add('get', '/version', 'Backend release identity', 'public', {
    output: z.object({ release })
  })
  add('post', '/auth/send-register-otp', 'Send registration OTP', 'public', {
    body: auth.sendRegisterOtpSchema,
    errors: [409, 429],
    note: 'Sends a real email. Resending within the cooldown returns 429.'
  })
  add('post', '/auth/register', 'Register an account', 'public', {
    body: auth.registerSchema,
    code: 201,
    errors: [400, 409],
    output: z.object({
      user: publicUser,
      accessToken: z.string(),
      refreshToken: z.string()
    }),
    note: 'OTP is required when ENABLE_EMAIL_VERIFICATION is enabled. Grants the configured signup Credit bonus.'
  })
  add('post', '/auth/forgot-password', 'Send password reset OTP', 'public', {
    body: auth.forgotPasswordSchema,
    errors: [403, 404, 429],
    note: 'Sends a real reset email to the specified existing account.'
  })
  add('post', '/auth/reset-password', 'Reset password using OTP', 'public', {
    body: auth.resetPasswordSchema,
    errors: [400, 403, 404],
    note: 'Changes the account password; use a controlled test account.'
  })
  add('post', '/auth/login', 'Authenticate an account', 'public', {
    body: auth.loginSchema,
    errors: [401, 403],
    output: z.object({
      user: publicUser,
      accessToken: z.string(),
      refreshToken: z.string()
    })
  })
  add('post', '/auth/refresh', 'Issue a new access token', 'public', {
    body: auth.refreshSchema,
    errors: [401, 403],
    output: z.object({ accessToken: z.string() })
  })
  add('post', '/auth/logout', 'Revoke a refresh token', 'public', {
    body: auth.refreshSchema,
    note: 'Revokes the supplied refresh token. Existing access tokens are not claimed to be immediately revoked.'
  })
  add('get', '/auth/me', 'Read current account', 'authenticated', {
    output: publicUser,
    errors: [404]
  })
  add('patch', '/auth/profile', 'Update account profile', 'authenticated', {
    body: auth.updateProfileSchema,
    output: publicUser,
    errors: [400, 404, 413, 429],
    note: 'Changes profile data. Inline image limit is 2 MiB; profile updates are rate limited.'
  })
  add(
    'patch',
    '/auth/change-password',
    'Change account password',
    'authenticated',
    {
      body: auth.changePasswordSchema,
      errors: [400, 404],
      note: 'newPassword and confirmPassword must match; this cross-field rule is validated by the backend.'
    }
  )
  add(
    'post',
    '/lectures/generate-outline',
    'Generate or refine an AI outline',
    'user',
    {
      body: lecture.generateOutlineSchema,
      output: generation.extend({ lecture: deck, outline }),
      errors: [402, 404],
      note: 'Calls the AI provider and charges configured outline Credit on success.'
    }
  )
  add('get', '/lectures', 'List and search owned lectures', 'user', {
    output: paged(deck),
    query: pagination.extend({
      folderId: z.string().optional(),
      sortBy: z.string().optional(),
      sortOrder: z.string().optional()
    })
  })
  add('post', '/lectures', 'Generate a lecture from an outline', 'user', {
    body: lecture.createLectureSchema,
    code: 201,
    output: deck.merge(generation),
    errors: [402, 404],
    note: 'Calls the AI provider, charges configured lecture Credit and persists the generated lecture.'
  })
  add('post', '/lectures/blank', 'Create a blank lecture without AI', 'user', {
    body: lecture.createBlankLectureSchema,
    code: 201,
    output: deck,
    errors: [404]
  })
  add('get', '/lectures/trash', 'List owned trashed lectures', 'user', {
    output: z.array(deck)
  })
  add('get', '/lectures/{id}', 'Read an owned lecture', 'user', {
    output: deck,
    errors: [404]
  })
  add('patch', '/lectures/{id}', 'Update an owned lecture', 'user', {
    body: lecture.updateLectureSchema,
    output: deck,
    errors: [404]
  })
  add('patch', '/lectures/{id}/autosave', 'Persist lecture edits', 'user', {
    body: lecture.updateLectureSchema,
    output: z.object({ lecture: deck, savedAt: z.string() }),
    errors: [404]
  })
  add('get', '/lectures/{id}/presentation', 'Read presentation data', 'user', {
    output: z.object({
      id: z.string(),
      title: z.string(),
      slides: z.array(slide),
      updatedAt: z.string()
    }),
    errors: [404]
  })
  add('post', '/lectures/{id}/ai-edit', 'Edit a slide using AI', 'user', {
    body: lecture.aiEditSlideSchema,
    output: generation.extend({ lecture: deck, slide }),
    errors: [402, 404],
    note: 'Calls the AI provider and charges configured edit Credit on success.'
  })
  add('post', '/lectures/{id}/ai-chat', 'Ask the AI editor assistant', 'user', {
    body: lecture.aiChatSchema,
    output: generation.extend({
      reply: z.string(),
      action: z.string(),
      aiChatHistory: z.array(z.record(z.unknown()))
    }),
    errors: [402, 404],
    note: 'Calls the AI provider. Charges depend on the returned action and accepted created-slide count.'
  })
  add(
    'post',
    '/lectures/{id}/slides',
    'Add, update, duplicate, move or delete a slide',
    'user',
    { body: lecture.slideOperationSchema, output: deck, errors: [400, 404] }
  )
  add(
    'post',
    '/lectures/{id}/duplicate',
    'Duplicate an owned lecture',
    'user',
    { code: 201, output: deck, errors: [404] }
  )
  add('delete', '/lectures/{id}', 'Move an owned lecture to trash', 'user', {
    output: message.passthrough(),
    errors: [404]
  })
  add('post', '/lectures/{id}/restore', 'Restore an owned lecture', 'user', {
    output: deck,
    errors: [404]
  })
  add(
    'delete',
    '/lectures/{id}/permanent',
    'Permanently delete an owned lecture',
    'user',
    {
      errors: [404],
      note: 'Deletes real data permanently; use a disposable lecture.'
    }
  )
  add('post', '/lectures/{id}/export', 'Export a JSON bundle', 'user', {
    output: z.object({
      message: z.string(),
      lectureId: z.string(),
      title: z.string(),
      downloadUrl: z.string().nullable(),
      data: z
        .object({
          id: z.string(),
          title: z.string(),
          slideCount: z.number(),
          slides: z.array(slide)
        })
        .passthrough()
    }),
    errors: [404],
    note: 'Creates a JSON export object when storage is available. A null downloadUrl indicates the documented inline-data fallback. This endpoint does not render a PDF.'
  })
  add('get', '/folders', 'List owned folders', 'user', {
    output: z.array(folderResult)
  })
  add('post', '/folders', 'Create an owned folder', 'user', {
    body: folder.createFolderSchema,
    code: 201,
    output: folderResult
  })
  add('patch', '/folders/{id}', 'Rename an owned folder', 'user', {
    body: folder.updateFolderSchema,
    output: folderResult,
    errors: [404]
  })
  add(
    'delete',
    '/folders/{id}',
    'Delete a folder and unfile its lectures',
    'user',
    { errors: [404] }
  )
  add('get', '/admin/users', 'List and search normal users', 'admin', {
    query: pagination,
    output: paged(adminUser),
    note: 'Admin accounts are excluded from this listing.'
  })
  add('post', '/admin/users', 'Create a normal user', 'admin', {
    body: admin.createUserSchema,
    code: 201,
    output: adminUser,
    errors: [409]
  })
  add('patch', '/admin/users/{id}', 'Update a normal user', 'admin', {
    body: admin.updateUserSchema,
    output: adminUser,
    errors: [404, 409],
    note: 'Provide at least one editable field. The exact editable fields are generated from this checkout’s validator.'
  })
  add(
    'patch',
    '/admin/users/{id}/lock',
    'Lock a normal user account',
    'admin',
    { output: adminUser, errors: [404] }
  )
  add(
    'patch',
    '/admin/users/{id}/restore',
    'Restore a locked account',
    'admin',
    { output: adminUser, errors: [404] }
  )
  add(
    'delete',
    '/admin/users/{id}',
    'Delete a normal user and owned database data',
    'admin',
    {
      output: message.passthrough(),
      errors: [404],
      note: 'Permanently deletes the account and its lectures, folders and AI usage records. Exported storage objects are not claimed to be deleted.'
    }
  )
  add(
    'get',
    '/admin/credit-config',
    'Read persisted Credit configuration',
    'admin',
    { output: creditResult }
  )
  add(
    'patch',
    '/admin/credit-config',
    'Update global Credit configuration',
    'admin',
    {
      body: admin.updateCreditConfigSchema,
      output: creditResult,
      note: 'Changes real global prices. Accepted fields and numeric constraints are generated from this checkout’s validator. Current develop rejects empty updates and unknown fields.'
    }
  )
  add('get', '/admin/ai-usage', 'Query AI usage history', 'admin', {
    query: pagination
      .merge(dateRange)
      .extend({ userId: z.string().optional() }),
    output: paged(usage),
    errors: [422],
    note: 'Date filtering uses UTC day boundaries.'
  })
  add('get', '/admin/dashboard', 'Query dashboard statistics', 'admin', {
    query: dateRange,
    output: dashboard,
    errors: [422],
    note: 'Date buckets use Asia/Ho_Chi_Minh (UTC+7); maximum range is 366 days.'
  })

  const actual = actualOperations()
  const documented = new Set<string>()
  const success = (schema: z.ZodTypeAny) =>
    z.object({ success: z.literal(true), data: schema })
  const errors: Record<number, string> = {
    400: 'Invalid business input or OTP',
    401: 'Missing, invalid, expired or revoked authentication',
    402: 'Insufficient Credit',
    403: 'Wrong role or forbidden account operation',
    404: 'Resource not found or not owned',
    409: 'Duplicate email',
    413: 'Request/image too large',
    422: 'Input validation failed',
    429: 'Cooldown or rate limit',
    500: 'Unhandled server/provider error'
  }
  for (const entry of entries) {
    const key = `${entry.method} ${entry.path}`
    if (!actual.includes(key)) continue // An older checkout must not advertise routes it does not implement.
    documented.add(key)
    const statuses = new Set([
      500,
      ...(entry.errors || []),
      ...(entry.body ? [422] : []),
      ...(entry.role === 'public' ? [] : [401]),
      ...(['user', 'admin'].includes(entry.role) ? [403] : [])
    ])
    const responses: Record<
      string,
      {
        description: string
        content: { 'application/json': { schema: z.ZodTypeAny } }
      }
    > = {
      [entry.code || 200]: {
        description: entry.code === 201 ? 'Created' : 'Successful response',
        content: {
          'application/json': { schema: success(entry.output || message) }
        }
      }
    }
    for (const status of statuses)
      responses[status] = {
        description: errors[status] || 'Dependency unavailable',
        content: {
          'application/json': {
            schema:
              status === 503
                ? z.object({ success: z.literal(false), data: health })
                : error
          }
        }
      }
    registry.registerPath({
      method: entry.method,
      path: entry.path,
      operationId: `${entry.method}_${entry.path.replace(/[^a-z0-9]+/gi, '_')}`,
      tags: [
        entry.path.startsWith('/admin')
          ? 'Admin'
          : entry.path.startsWith('/auth')
            ? 'Authentication'
            : entry.path.startsWith('/lectures')
              ? 'Lectures'
              : entry.path.startsWith('/folders')
                ? 'Folders'
                : 'Health'
      ],
      summary: entry.summary,
      description: `Access: ${entry.role}. ${entry.note || ''}`,
      security: entry.role === 'public' ? [] : [{ BearerAuth: [] }],
      request: {
        ...(entry.path.includes('{id}')
          ? { params: z.object({ id: objectId }) }
          : {}),
        ...(entry.query ? { query: entry.query } : {}),
        ...(entry.body
          ? {
              body: {
                required: true,
                content: { 'application/json': { schema: entry.body } }
              }
            }
          : {})
      },
      responses
    })
  }
  const missing = actual.filter((key) => !documented.has(key))
  if (missing.length)
    throw new Error('Undocumented backend operations: ' + missing.join(', '))
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'ABSlider API',
      version: '0.1.0-dev',
      description:
        'Generated from backend validators and an audited route catalog. Try it out sends real requests; this explorer is not an automated test-results report.'
    },
    servers: [
      {
        url: '/api/v1',
        description: 'This backend origin (local or deployed)'
      }
    ]
  })
}
