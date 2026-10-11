import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import type { Readable } from 'node:stream'
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

/**
 * Stores a file in the private bucket without building a URL for it. Used for venue photos and logos,
 * which are served to browsers through the API (see getObject) — the bucket itself is never public.
 */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket:      env.STORAGE_BUCKET,
      Key:         key,
      Body:        body,
      ContentType: contentType,
    }),
  )
}

export interface StoredObject {
  body:          Readable
  contentType:   string
  contentLength: number | undefined
}

/** Reads an object from the private bucket, or returns null if it does not exist. */
export async function getObject(key: string): Promise<StoredObject | null> {
  try {
    const res = await s3Client.send(new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }))
    if (!res.Body) return null
    return {
      body:          res.Body as Readable,
      contentType:   res.ContentType ?? 'application/octet-stream',
      contentLength: res.ContentLength,
    }
  } catch (err) {
    const name = (err as { name?: string }).name
    if (name === 'NoSuchKey' || name === 'NotFound') return null
    throw err
  }
}

export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }))
}
