# API app — Fastify context

See root CLAUDE.md for full platform context.

## This app's job
REST API server. All business logic. Serves both the web dashboard and
the marketplace. Runs on Railway.

## Key files
- src/app.ts          Fastify instance, plugin registration, start server
- src/routes/         One file per domain, each exports register(fastify)
- src/middleware/     auth.ts + rbac.ts — applied in routes, not globally
- src/services/       Business logic — routes call services, not Prisma directly
- src/jobs/           BullMQ job definitions (enqueued here, processed in worker)
- src/lib/redis.ts    Shared ioredis client singleton
- src/lib/prisma.ts   Shared Prisma client singleton
- src/lib/encrypt.ts  AES-256 encrypt/decrypt for gateway credentials

## Plugin registration order in app.ts
1. @fastify/helmet
2. @fastify/cors (origin from env)
3. @fastify/rate-limit (Redis store)
4. @fastify/multipart (for slip image uploads)
5. Routes (auth, company, locations, sub-venues, slots, bookings, payments, marketplace, admin)

## Route pattern
```ts
export async function register(fastify: FastifyInstance) {
  fastify.post('/path', {
    schema: { body: zodToJsonSchema(BodySchema) },
    preHandler: [authMiddleware, requirePermission('permission.key')]
  }, async (req, reply) => {
    const result = await someService(req.actor, req.body)
    return reply.send({ data: result })
  })
}
```

## Slot locking — exact implementation
```ts
// In services/slot-lock.ts
const key = `slot:lock:${slotId}`
const set = await redis.set(key, lockToken, 'EX', 600, 'NX')
if (!set) throw new ConflictError('Slot already locked')
// Then SELECT FOR UPDATE in Prisma transaction
```

## Error classes
Define in src/lib/errors.ts:
AppError (base), ValidationError (400), UnauthorizedError (401),
ForbiddenError (403), NotFoundError (404), ConflictError (409)
Fastify error handler maps these to correct HTTP status codes.