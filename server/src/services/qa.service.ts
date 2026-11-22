import { redis } from '@/lib/redis'
import { UserModel } from '@/models/user.model'
import { z } from 'zod'
import { env } from '@/config/env'
import { AppError } from '@/utils/AppError'

const common = {
  targetEmail: z.string().trim().email().toLowerCase(),
  ttlSec: z
    .number()
    .int()
    .positive()
    .default(600)
    .transform((ttl) => Math.min(ttl, 1800))
}
export const faultSchema = z.discriminatedUnion('fault', [
  z.object({
    ...common,
    fault: z.literal('ai_delay'),
    params: z
      .object({
        delayMs: z.number().int().min(1000).max(300000),
        bypassAppTimeout: z.boolean().optional()
      })
      .strict()
  }),
  z.object({
    ...common,
    fault: z.literal('ai_error'),
    params: z
      .object({
        status: z.union([
          z.literal(429),
          z.literal(500),
          z.literal(502),
          z.literal(503),
          z.literal(504)
        ])
      })
      .strict()
  }),
  z.object({
    ...common,
    fault: z.literal('storage_down'),
    params: z.object({}).strict().default({})
  }),
  z.object({
    ...common,
    fault: z.literal('ai_invalid_output'),
    params: z
      .object({ kind: z.enum(['bad_json', 'missing_fields', 'empty']) })
      .strict()
  })
])
export const faultFilter = z
  .object({
    fault: z
      .enum(['ai_delay', 'ai_error', 'storage_down', 'ai_invalid_output'])
      .optional(),
    targetEmail: common.targetEmail.optional()
  })
  .strict()
type Fault = z.infer<typeof faultSchema>
type FaultParams = { [Entry in Fault as Entry['fault']]: Entry['params'] }
const keyFor = (fault: Fault['fault'], userId: string) =>
  `qa:fault:${fault}:${userId}`

export async function getFault<K extends Fault['fault']>(
  fault: K,
  userId?: string
): Promise<FaultParams[K] | undefined> {
  if (!env.QA_FAULTS_ENABLED || !userId) return
  const raw = await redis.get(keyFor(fault, userId))
  if (raw) {
    const entry = faultSchema.parse(JSON.parse(raw))
    if (entry.fault === fault) return entry.params as FaultParams[K]
  }
}
export async function setFault(input: Fault) {
  const user = await UserModel.findOne({ email: input.targetEmail })
    .select('_id')
    .lean()
  if (!user) throw new AppError('Không tìm thấy tài khoản', 404)
  await redis.set(
    keyFor(input.fault, String(user._id)),
    JSON.stringify(input),
    'EX',
    input.ttlSec
  )
  return { ...input, expiresInSec: input.ttlSec }
}
export async function listFaults(
  filter: z.infer<typeof faultFilter> = {},
  clear = false
) {
  const active: Array<Fault & { expiresInSec: number }> = []
  let cleared = 0
  let cursor = '0'
  do {
    const [next, keys] = await redis.scan(
      cursor,
      'MATCH',
      `qa:fault:${filter.fault ?? '*'}:*`,
      'COUNT',
      100
    )
    cursor = next
    for (const key of keys) {
      const [raw, expiresInSec] = await Promise.all([
        redis.get(key),
        redis.ttl(key)
      ])
      if (!raw || expiresInSec <= 0) continue
      const entry = JSON.parse(raw) as Fault
      if (filter.targetEmail && entry.targetEmail !== filter.targetEmail)
        continue
      if (clear) cleared += await redis.del(key)
      else active.push({ ...entry, expiresInSec })
    }
  } while (cursor !== '0')
  return { active, cleared }
}
