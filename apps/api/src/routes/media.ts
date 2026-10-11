import type { FastifyInstance, FastifyRequest } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { AddVideoBodySchema, ReorderMediaBodySchema, UpdateMediaBodySchema } from '@sports-booking/types'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import { getObject } from '../lib/storage.js'
import {
  MAX_IMAGE_BYTES,
  addImage,
  addVideo,
  deleteMedia,
  isAllowedImageType,
  isPublicKey,
  listMedia,
  reorderMedia,
  updateMedia,
  uploadLogo,
} from '../services/media.service.js'

const guard = [authMiddleware, requirePermission('company.branding')]

function companyIdOf(req: FastifyRequest): string {
  if (req.actor.type !== 'venue_staff') {
    throw new ForbiddenError('Only venue staff can manage media')
  }
  return req.actor.company_id
}

/** Reads one image file (plus an optional caption) from a multipart request. */
async function readImageUpload(req: FastifyRequest) {
  let file: Buffer | undefined
  let mimetype: string | undefined
  let caption: string | undefined

  for await (const part of req.parts()) {
    if (part.type === 'file') {
      if (!isAllowedImageType(part.mimetype)) {
        throw new ValidationError('Unsupported image type. Allowed: JPEG, PNG, WEBP')
      }
      const buffer = await part.toBuffer()
      if (buffer.length > MAX_IMAGE_BYTES) {
        throw new ValidationError('Image exceeds the 5MB limit')
      }
      file = buffer
      mimetype = part.mimetype
    } else if (part.fieldname === 'caption') {
      caption = String(part.value).slice(0, 200)
    }
  }

  if (!file || !mimetype) {
    throw new ValidationError('An image file is required')
  }
  return { file, mimetype, caption }
}

export async function register(fastify: FastifyInstance) {
  // Public: streams a venue photo/logo from the private bucket. Keys contain a random UUID, so they
  // never change and can be cached for a year. Only media/ and logos/ keys are served.
  fastify.get<{ Params: { '*': string } }>(
    '/files/*',
    { config: { rateLimit: { max: 1000, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const key = req.params['*']
      if (!isPublicKey(key)) {
        throw new NotFoundError('File')
      }
      const object = await getObject(key)
      if (!object) {
        throw new NotFoundError('File')
      }

      reply
        .header('Content-Type', object.contentType)
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        // helmet defaults to same-origin, which would stop the web app (another origin) from showing these
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .header('X-Content-Type-Options', 'nosniff')
      if (object.contentLength !== undefined) {
        reply.header('Content-Length', object.contentLength)
      }
      return reply.send(object.body)
    },
  )

  fastify.get('/', { preHandler: guard }, async (req, reply) => {
    return reply.send({ data: await listMedia(companyIdOf(req)) })
  })

  fastify.post('/images', { preHandler: guard }, async (req, reply) => {
    const companyId = companyIdOf(req)
    const { file, mimetype, caption } = await readImageUpload(req)
    return reply.status(201).send({ data: await addImage(companyId, file, mimetype, caption) })
  })

  fastify.post('/logo', { preHandler: guard }, async (req, reply) => {
    const companyId = companyIdOf(req)
    const { file, mimetype } = await readImageUpload(req)
    return reply.status(201).send({ data: await uploadLogo(companyId, file, mimetype) })
  })

  fastify.post(
    '/videos',
    { schema: { body: zodToJsonSchema(AddVideoBodySchema) }, preHandler: guard },
    async (req, reply) => {
      const body = AddVideoBodySchema.parse(req.body)
      return reply.status(201).send({ data: await addVideo(companyIdOf(req), body) })
    },
  )

  fastify.put(
    '/reorder',
    { schema: { body: zodToJsonSchema(ReorderMediaBodySchema) }, preHandler: guard },
    async (req, reply) => {
      const body = ReorderMediaBodySchema.parse(req.body)
      return reply.send({ data: await reorderMedia(companyIdOf(req), body.ids) })
    },
  )

  fastify.patch<{ Params: { mediaId: string } }>(
    '/:mediaId',
    { schema: { body: zodToJsonSchema(UpdateMediaBodySchema) }, preHandler: guard },
    async (req, reply) => {
      const body = UpdateMediaBodySchema.parse(req.body)
      return reply.send({ data: await updateMedia(companyIdOf(req), req.params.mediaId, body) })
    },
  )

  fastify.delete<{ Params: { mediaId: string } }>('/:mediaId', { preHandler: guard }, async (req, reply) => {
    await deleteMedia(companyIdOf(req), req.params.mediaId)
    return reply.send({ data: { deleted: true } })
  })
}
