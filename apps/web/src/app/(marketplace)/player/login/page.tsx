'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CustomerLoginBodySchema, type CustomerLoginBody } from '@sports-booking/types'
import { Loader2 } from 'lucide-react'

import { usePlayerAuth } from '@/hooks/usePlayerAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { AuthShell } from '@/components/marketplace/AuthShell'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'

export default function PlayerLoginPage() {
  return (
    <Suspense fallback={<LoadingPanel className="py-24" />}>
      <PlayerLoginForm />
    </Suspense>
  )
}

function PlayerLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = usePlayerAuth()

  const form = useForm<CustomerLoginBody>({
    resolver: zodResolver(CustomerLoginBodySchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = (values: CustomerLoginBody) => {
    login.mutate(values, {
      onSuccess: () => {
        router.push(searchParams.get('redirect') ?? '/my-bookings')
      },
    })
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your bookings"
      footer={
        <>
          New here?{' '}
          <Link href="/player/register" className="font-semibold text-primary hover:underline">
            Create an account
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
