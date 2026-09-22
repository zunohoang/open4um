import { Client } from 'minio'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'

const parseMinioEndpoint = (endpoint: string, useSSL: boolean) => {
  const url = new URL(`${useSSL ? 'https' : 'http'}://${endpoint}`)
  return {
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : useSSL ? 443 : 9000,
    useSSL
  }
}

const internalEndpoint = parseMinioEndpoint(
  env.MINIO_ENDPOINT,
  env.MINIO_USE_SSL
)

export const minioClient = new Client({
  ...internalEndpoint,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
  region: 'us-east-1'
})

const publicMinioUrl = env.MINIO_PUBLIC_ENDPOINT
  ? new URL(env.MINIO_PUBLIC_ENDPOINT)
  : null

export const minioPresignClient = publicMinioUrl
  ? new Client({
      endPoint: publicMinioUrl.hostname,
      port: publicMinioUrl.port ? Number(publicMinioUrl.port) : 443,
      useSSL: publicMinioUrl.protocol === 'https:',
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
      region: 'us-east-1'
    })
  : minioClient

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
