import { createHash } from 'node:crypto'
import { uploadImage } from '@/lib/storage'
import { AppError } from '@/utils/AppError'
import { logger } from '@/lib/logger'

// A stable object key makes a restarted migration or repeated save idempotent.
export async function externalizeImages(
  owner: string,
  values: unknown[],
  tolerateInvalid = false
) {
  const urls = new Map<string, string>()
  async function visit(value: unknown): Promise<void> {
    if (!value || typeof value !== 'object') return
    const record = value as Record<string, unknown>
    if (record.type === 'image') {
      for (const field of ['imageUrl', 'content']) {
        const data = record[field]
        if (typeof data !== 'string' || !data.startsWith('data:image/'))
          continue
        let url = urls.get(data)
        if (!url) {
          const hash = createHash('sha256')
            .update(owner)
            .update(data)
            .digest('hex')
          const id = [
            hash.slice(0, 8),
            hash.slice(8, 12),
            hash.slice(12, 16),
            hash.slice(16, 20),
            hash.slice(20, 32)
          ].join('-')
          try {
            url =
              '/api/v1/media/' +
              (await uploadImage(owner, data, 5 * 1024 * 1024, id)).key
          } catch (error) {
            if (
              !tolerateInvalid ||
              !(error instanceof AppError) ||
              ![413, 422].includes(error.statusCode)
            )
              throw error
            logger.warn(
              { owner, image: id },
              'Giữ nguyên ảnh cũ không thể chuyển đổi'
            )
            continue
          }
          urls.set(data, url)
        }
        record[field] = url
      }
    }
    for (const child of Object.values(record)) {
      if (child && typeof child === 'object') await visit(child)
    }
  }
  await visit(values)
  return urls.size > 0
}
