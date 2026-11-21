import { randomUUID } from 'node:crypto'
import { minioClient, BUCKET_MEDIA } from '@/lib/minio'
import { logger } from '@/lib/logger'
import { requestContext } from '@/middlewares/requestContext.middleware'
import { getFault } from '@/services/qa.service'
import { AppError } from '@/utils/AppError'
import { decodeImageDataUrl } from '@/utils/imageData'

const imageKey = /^images\/([a-f0-9]{24})\/[0-9a-f-]{36}\.(png|jpg|webp|gif)$/
const storageMessage =
  'Dịch vụ lưu trữ tệp tạm thời không phản hồi. Vui lòng thử lại sau.'

async function storageOperation<T>(
  owner: string,
  read: boolean,
  operation: () => Promise<T>
) {
  try {
    if (requestContext.getStore() && (await getFault('storage_down', owner)))
      throw Object.assign(new Error('Storage unavailable'), {
        code: 'ECONNREFUSED'
      })
    return await operation()
  } catch (err) {
    const code = (err as { code?: string }).code
    if (read && (code === 'NotFound' || code === 'NoSuchKey'))
      throw new AppError('Không tìm thấy ảnh', 404)
    logger.error(
      { err, requestId: requestContext.getStore()?.requestId },
      'Lỗi kho lưu trữ ảnh'
    )
    throw new AppError(storageMessage, 503)
  }
}

export async function uploadImage(
  owner: string,
  dataUrl: string,
  maxBytes = 5 * 1024 * 1024,
  id: string = randomUUID()
) {
  const { buffer, mime } = decodeImageDataUrl(dataUrl, maxBytes)
  const ext = mime.slice(6).replace('jpeg', 'jpg')
  const key = `images/${owner}/${id}.${ext}`
  await storageOperation(owner, false, () =>
    minioClient.putObject(BUCKET_MEDIA, key, buffer, buffer.length, {
      'Content-Type': mime
    })
  )
  return { key }
}

export async function getImage(key: string) {
  const match = imageKey.exec(key)
  if (!match) throw new AppError('Không tìm thấy ảnh', 404)
  return storageOperation(match[1], true, async () => {
    const stat = await minioClient.statObject(BUCKET_MEDIA, key)
    const stream = await minioClient.getObject(BUCKET_MEDIA, key)
    return {
      stream,
      size: stat.size,
      contentType: String(
        stat.metaData?.['content-type'] ?? 'application/octet-stream'
      )
    }
  })
}
