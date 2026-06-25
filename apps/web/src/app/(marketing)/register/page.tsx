'use client'

import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RegisterBodySchema, type RegisterBody } from '@sports-booking/types'
import { Check, Loader2 } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const TIERS = [
  {
    name: 'Basic',
    price: 'LKR 2,900/mo',
    description: 'Get started with a single venue',
    features: ['1 location', 'Marketplace profile', 'Admin & receptionist roles'],
  },
  {
    name: 'Pro',
    price: 'LKR 7,900/mo',
    description: 'Grow across multiple locations',
    features: ['Multi-location support', 'Branded subdomain', 'Location manager role'],
  },
  {
    name: 'Elite',
    price: 'LKR 19,900/mo',
    description: 'Full control for established brands',
    features: ['Unlimited locations', 'Custom domain', 'Full RBAC & custom email'],
  },
]

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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4 py-10">
      <div className="flex w-full max-w-4xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Register your venue</CardTitle>
            <CardDescription>Create your owner account and company workspace</CardDescription>
          </CardHeader>
          <CardContent>
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

                <Button type="submit" className="w-full" disabled={register.isPending}>
                  {register.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create account
                </Button>
              </form>
            </Form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-1 text-center text-lg font-semibold">Plans built for every stage</h2>
          <p className="mb-4 text-center text-sm text-muted-foreground">
            All accounts start on the <strong>Basic plan</strong>. You can upgrade anytime from your dashboard settings.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="rounded-lg border bg-background p-4 text-left"
              >
                <div className="font-semibold">{tier.name}</div>
                <div className="mb-1 text-sm font-medium text-primary">{tier.price}</div>
                <p className="mb-3 text-sm text-muted-foreground">{tier.description}</p>
                <ul className="space-y-1 text-sm">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
