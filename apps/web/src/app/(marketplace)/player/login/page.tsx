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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
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
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to manage your bookings</CardDescription>
        </CardHeader>
        <CardContent>
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
              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            New here?{' '}
            <Link href="/player/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
