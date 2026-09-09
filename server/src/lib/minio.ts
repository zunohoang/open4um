import { Client } from 'minio'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'

const parseMinioEndpoint = (endpoint: string) => {
  const [host, port] = endpoint.split(':')
  return {
    endPoint: host || 'localhost',
    port: port ? parseInt(port, 10) : 9000
  }
}

const { endPoint, port } = parseMinioEndpoint(env.MINIO_ENDPOINT)

export const minioClient = new Client({
  endPoint,
  port,
  useSSL: false,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY
})

export const BUCKET_MEDIA = 'media'

export const connectMinio = async () => {
  try {
    const exists = await minioClient.bucketExists(BUCKET_MEDIA)
    if (!exists) {
      await minioClient.makeBucket(BUCKET_MEDIA)
    }
    logger.info('✅ Kết nối MinIO')
  } catch (err) {
    logger.error({ err }, '❌ Kết nối MinIO thất bại')
    throw err
  }
}
