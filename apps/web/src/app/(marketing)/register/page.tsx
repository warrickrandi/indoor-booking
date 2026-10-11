'use client'

import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RegisterBodySchema, type RegisterBody } from '@sports-booking/types'
import { Loader2 } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthShell } from '@/components/marketplace/AuthShell'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

export default function RegisterPage() {
  const { register } = useAuth()

  const form = useForm<RegisterBody>({
    resolver: zodResolver(RegisterBodySchema),
    defaultValues: { full_name: '', email: '', phone: '', password: '', company_name: '', slug: '' },
  })

  const onSubmit = (values: RegisterBody) => {
    const payload = { ...values, slug: values.slug || undefined }
    register.mutate(payload)
  }

  return (
    <AuthShell
      variant="owner"
      width="lg"
      title="Register your venue"
      subtitle="Create your owner account and company workspace. Every account starts with a 14-day free trial on the Basic plan."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
          {' '}&middot;{' '}
          <Link href="/pricing" className="font-semibold text-primary hover:underline">
            See plans
          </Link>
        </>
      }
    >
      <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Silva" {...field} />
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+94 77 123 4567" {...field} />
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company name</FormLabel>
                        <FormControl>
                          <Input placeholder="Colombo Futsal Arena" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subdomain (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="colombo-futsal" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" size="lg" className="w-full rounded-full" disabled={register.isPending}>
                  {register.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create account
                </Button>
              </form>
            </Form>
    </AuthShell>
  )
}
