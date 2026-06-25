import type { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  RegisterBodySchema,
  LoginBodySchema,
  RefreshBodySchema,
  ForgotPasswordBodySchema,
  ResetPasswordBodySchema,
} from '@sports-booking/types'
import { authMiddleware } from '../middleware/auth.js'
import {
  registerVenueOwner,
  loginVenueStaff,
  loginPlatformAdmin,
  refreshVenueToken,
  logoutVenueStaff,
  forgotPassword,
  resetPassword,
} from '../services/auth.service.js'

const AUTH_RATE_LIMIT = { rateLimit: { max: 10, timeWindow: '1 minute' } }

export async function register(fastify: FastifyInstance) {
  fastify.post(
    '/register',
    { schema: { body: zodToJsonSchema(RegisterBodySchema) }, config: AUTH_RATE_LIMIT },
    async (req, reply) => {
      const body = RegisterBodySchema.parse(req.body)
      const result = await registerVenueOwner(body)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/login',
    { schema: { body: zodToJsonSchema(LoginBodySchema) }, config: AUTH_RATE_LIMIT },
    async (req, reply) => {
      const body = LoginBodySchema.parse(req.body)
      const result = await loginVenueStaff(body)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/admin-login',
    { schema: { body: zodToJsonSchema(LoginBodySchema) }, config: AUTH_RATE_LIMIT },
    async (req, reply) => {
      const body = LoginBodySchema.parse(req.body)
      const result = await loginPlatformAdmin(body)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/refresh',
    { schema: { body: zodToJsonSchema(RefreshBodySchema) }, config: AUTH_RATE_LIMIT },
    async (req, reply) => {
      const body = RefreshBodySchema.parse(req.body)
      const result = await refreshVenueToken(body.refresh_token)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/logout',
    { preHandler: [authMiddleware] },
    async (req, reply) => {
      const result = await logoutVenueStaff(req.actor.sub)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/forgot-password',
    { schema: { body: zodToJsonSchema(ForgotPasswordBodySchema) }, config: AUTH_RATE_LIMIT },
    async (req, reply) => {
      const body = ForgotPasswordBodySchema.parse(req.body)
      const result = await forgotPassword(body.email)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/reset-password',
    { schema: { body: zodToJsonSchema(ResetPasswordBodySchema) }, config: AUTH_RATE_LIMIT },
    async (req, reply) => {
      const body = ResetPasswordBodySchema.parse(req.body)
      const result = await resetPassword(body.token, body.new_password)
      return reply.send({ data: result })
    },
  )
}
