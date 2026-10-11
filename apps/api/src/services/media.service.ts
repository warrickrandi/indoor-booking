import crypto from 'node:crypto'
import type { VenueMedia } from '@sports-booking/db'
import type { AddVideoBody, UpdateMediaBody } from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { env } from '../lib/env.js'
import { deleteFile, putObject } from '../lib/storage.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_MEDIA_PER_COMPANY = 30

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
}

export function isAllowedImageType(mimetype: string): boolean {
  return mimetype in IMAGE_EXT_BY_MIME
}

/** Turns a YouTube or Vimeo link into its embeddable player URL; anything else is rejected. */
export function toEmbedUrl(rawUrl: string): string {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new ValidationError('Enter a valid video link')
  }
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0]
    if (id) return `https://www.youtube-nocookie.com/embed/${id}`
  }
  if (host === 'youtube.com' || host === 'music.youtube.com') {
    const fromQuery = url.searchParams.get('v')
    if (fromQuery) return `https://www.youtube-nocookie.com/embed/${fromQuery}`
    const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)
    if (match?.[1]) return `https://www.youtube-nocookie.com/embed/${match[1]}`
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const match = url.pathname.match(/(\d{6,})/)
    if (match?.[1]) return `https://player.vimeo.com/video/${match[1]}`
  }

  throw new ValidationError('Only YouTube and Vimeo links are supported')
}

/** Public URL of a stored file. Files are served by this API, never directly from the bucket. */
export function fileUrl(key: string): string {
  return `${env.API_URL}/api/v1/media/files/${key}`
}

/** Only photos and logos are served publicly; everything else in the bucket (e.g. payment slips) stays private. */
export function isPublicKey(key: string): boolean {
  return /^(media|logos)\/[\w-]+\/[\w-]+\.(jpg|png|webp)$/.test(key)
}

export function serializeMedia(media: VenueMedia) {
  return {
    id:            media.id,
    type:          media.type as 'image' | 'video',
    url:           media.type === 'image' && media.storage_key ? fileUrl(media.storage_key) : media.url,
    embed_url:     media.type === 'video' ? toEmbedUrl(media.url) : null,
    caption:       media.caption,
    is_cover:      media.is_cover,
    display_order: media.display_order,
  }
}

async function getOwned(companyId: string, mediaId: string): Promise<VenueMedia> {
  const media = await prisma.venueMedia.findFirst({ where: { id: mediaId, company_id: companyId } })
  if (!media) {
    throw new NotFoundError('Media')
  }
  return media
}

async function assertRoom(companyId: string): Promise<void> {
  const count = await prisma.venueMedia.count({ where: { company_id: companyId } })
  if (count >= MAX_MEDIA_PER_COMPANY) {
    throw new ValidationError(`You can add up to ${MAX_MEDIA_PER_COMPANY} photos and videos`)
  }
}

async function nextOrder(companyId: string): Promise<number> {
  const last = await prisma.venueMedia.findFirst({
    where:   { company_id: companyId },
    orderBy: { display_order: 'desc' },
    select:  { display_order: true },
  })
  return (last?.display_order ?? -1) + 1
}

export async function listMedia(companyId: string) {
  const items = await prisma.venueMedia.findMany({
    where:   { company_id: companyId },
    orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
  })
  return items.map(serializeMedia)
}

export async function addImage(companyId: string, file: Buffer, mimetype: string, caption?: string) {
  if (!isAllowedImageType(mimetype)) {
    throw new ValidationError('Unsupported image type. Allowed: JPEG, PNG, WEBP')
  }
  if (file.length > MAX_IMAGE_BYTES) {
    throw new ValidationError('Image exceeds the 5MB limit')
  }
  await assertRoom(companyId)

  const key = `media/${companyId}/${crypto.randomUUID()}.${IMAGE_EXT_BY_MIME[mimetype]}`
  await putObject(key, file, mimetype)

  const hasCover = (await prisma.venueMedia.count({ where: { company_id: companyId, type: 'image', is_cover: true } })) > 0

  const media = await prisma.venueMedia.create({
    data: {
      company_id:    companyId,
      type:          'image',
      url:           key,
      storage_key:   key,
      caption:       caption?.trim() || null,
      is_cover:      !hasCover,
      display_order: await nextOrder(companyId),
    },
  })
  return serializeMedia(media)
}

export async function addVideo(companyId: string, input: AddVideoBody) {
  toEmbedUrl(input.url) // validates the link
  await assertRoom(companyId)

  const media = await prisma.venueMedia.create({
    data: {
      company_id:    companyId,
      type:          'video',
      url:           input.url,
      caption:       input.caption?.trim() || null,
      display_order: await nextOrder(companyId),
    },
  })
  return serializeMedia(media)
}

export async function updateMedia(companyId: string, mediaId: string, input: UpdateMediaBody) {
  const media = await getOwned(companyId, mediaId)

  if (input.is_cover && media.type !== 'image') {
    throw new ValidationError('Only photos can be the cover')
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.is_cover) {
      await tx.venueMedia.updateMany({ where: { company_id: companyId, is_cover: true }, data: { is_cover: false } })
    }
    return tx.venueMedia.update({
      where: { id: mediaId },
      data: {
        ...(input.caption !== undefined ? { caption: input.caption?.trim() || null } : {}),
        ...(input.is_cover !== undefined ? { is_cover: input.is_cover } : {}),
      },
    })
  })
  return serializeMedia(updated)
}

export async function reorderMedia(companyId: string, ids: string[]) {
  const owned = await prisma.venueMedia.findMany({ where: { company_id: companyId }, select: { id: true } })
  const ownedIds = new Set(owned.map((m) => m.id))
  if (ids.some((id) => !ownedIds.has(id))) {
    throw new ValidationError('Unknown media in the new order')
  }

  await prisma.$transaction(
    ids.map((id, index) => prisma.venueMedia.update({ where: { id }, data: { display_order: index } })),
  )
  return listMedia(companyId)
}

export async function deleteMedia(companyId: string, mediaId: string) {
  const media = await getOwned(companyId, mediaId)

  if (media.storage_key) {
    // A failed storage delete must not leave a dangling row the owner can never remove.
    await deleteFile(media.storage_key).catch(() => undefined)
  }
  await prisma.venueMedia.delete({ where: { id: mediaId } })

  if (media.is_cover) {
    const next = await prisma.venueMedia.findFirst({
      where:   { company_id: companyId, type: 'image' },
      orderBy: { display_order: 'asc' },
    })
    if (next) {
      await prisma.venueMedia.update({ where: { id: next.id }, data: { is_cover: true } })
    }
  }
}

export async function uploadLogo(companyId: string, file: Buffer, mimetype: string) {
  if (!isAllowedImageType(mimetype)) {
    throw new ValidationError('Unsupported image type. Allowed: JPEG, PNG, WEBP')
  }
  if (file.length > MAX_IMAGE_BYTES) {
    throw new ValidationError('Image exceeds the 5MB limit')
  }

  const key = `logos/${companyId}/${crypto.randomUUID()}.${IMAGE_EXT_BY_MIME[mimetype]}`
  await putObject(key, file, mimetype)
  const url = fileUrl(key)

  await prisma.companyBranding.upsert({
    where:  { company_id: companyId },
    update: { logo_url: url },
    create: { company_id: companyId, logo_url: url },
  })
  return { logo_url: url }
}
