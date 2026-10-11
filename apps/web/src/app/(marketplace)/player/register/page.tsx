'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CustomerRegisterBodySchema, type CustomerRegisterBody } from '@sports-booking/types'
import { Loader2 } from 'lucide-react'

import { usePlayerAuth } from '@/hooks/usePlayerAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthShell } from '@/components/marketplace/AuthShell'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

export default function PlayerRegisterPage() {
  const router = useRouter()
  const { register } = usePlayerAuth()

  const form = useForm<CustomerRegisterBody>({
    resolver: zodResolver(CustomerRegisterBodySchema),
    defaultValues: { full_name: '', email: '', phone: '', password: '' },
  })

  const onSubmit = (values: CustomerRegisterBody) => {
    register.mutate(values, {
      onSuccess: () => {
        router.push('/my-bookings')
      },
    })
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Book and manage your slots in one place"
      footer={
        <>
          Already have an account?{' '}
          <Link href="/player/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="07XXXXXXXX" {...field} />
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
                      <Input type="password" placeholder="At least 8 characters" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" className="w-full rounded-full" disabled={register.isPending}>
                {register.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create account
              </Button>
            </form>
          </Form>
    </AuthShell>
  )
}
