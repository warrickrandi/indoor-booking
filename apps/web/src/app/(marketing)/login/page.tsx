'use client'

import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoginBodySchema, type LoginBody } from '@sports-booking/types'
import { Loader2 } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthShell } from '@/components/marketplace/AuthShell'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

export default function LoginPage() {
  const { login } = useAuth()

  const form = useForm<LoginBody>({
    resolver: zodResolver(LoginBodySchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = (values: LoginBody) => {
    login.mutate(values)
  }

  return (
    <AuthShell
      variant="owner"
      title="Venue login"
      subtitle="Sign in to your venue dashboard"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            Register your venue
          </Link>
        </>
      }
    >
      <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" className="w-full rounded-full" disabled={login.isPending}>
                {login.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </Form>
    </AuthShell>
  )
}
