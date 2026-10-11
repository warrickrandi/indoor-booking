import { z } from 'zod'

export const AddVideoBodySchema = z.object({
  url:     z.string().url(),
  caption: z.string().max(200).optional(),
})

export const UpdateMediaBodySchema = z.object({
  caption:  z.string().max(200).nullable().optional(),
  is_cover: z.boolean().optional(),
})

export const ReorderMediaBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
})

export type AddVideoBody     = z.infer<typeof AddVideoBodySchema>
export type UpdateMediaBody  = z.infer<typeof UpdateMediaBodySchema>
export type ReorderMediaBody = z.infer<typeof ReorderMediaBodySchema>
