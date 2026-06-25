import { z } from 'zod'

export const RegisterBodySchema = z.object({
  full_name:    z.string().min(1),
  email:        z.string().email(),
  phone:        z.string().min(1),
  password:     z.string().min(8),
  company_name: z.string().min(1),
  slug:         z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
})

export const LoginBodySchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export const RefreshBodySchema = z.object({
  refresh_token: z.string().min(1),
})

export const ForgotPasswordBodySchema = z.object({
  email: z.string().email(),
})

export const ResetPasswordBodySchema = z.object({
  token:        z.string().min(1),
  new_password: z.string().min(8),
})

export const CustomerRegisterBodySchema = z.object({
  full_name: z.string().min(1),
  email:     z.string().email(),
  phone:     z.string().min(1),
  password:  z.string().min(8),
})

export const CustomerLoginBodySchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export type RegisterBody         = z.infer<typeof RegisterBodySchema>
export type LoginBody            = z.infer<typeof LoginBodySchema>
export type RefreshBody          = z.infer<typeof RefreshBodySchema>
export type ForgotPasswordBody   = z.infer<typeof ForgotPasswordBodySchema>
export type ResetPasswordBody    = z.infer<typeof ResetPasswordBodySchema>
export type CustomerRegisterBody = z.infer<typeof CustomerRegisterBodySchema>
export type CustomerLoginBody    = z.infer<typeof CustomerLoginBodySchema>
