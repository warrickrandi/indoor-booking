import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { env } from './env.js'

const s3Client = new S3Client({
  endpoint:        env.STORAGE_ENDPOINT,
  region:          'auto',
  forcePathStyle:  true,
  credentials: {
    accessKeyId:     env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
})

export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket:      env.STORAGE_BUCKET,
      Key:         key,
      Body:        body,
      ContentType: contentType,
    }),
  )

  return `${env.STORAGE_ENDPOINT}/${env.STORAGE_BUCKET}/${key}`
}
