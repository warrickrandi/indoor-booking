'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreateLocationBodySchema, type CreateLocationBody } from '@sports-booking/types'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { post, showApiErrorToast } from '@/lib/api'
import type { LocationDetail } from '@/hooks/useLocations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PageHeader } from '@/components/shared/PageHeader'

export default function NewLocationPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const form = useForm<CreateLocationBody>({
    resolver: zodResolver(CreateLocationBodySchema),
    defaultValues: { name: '', address: '', city: '', timezone: 'Asia/Colombo', phone: '' },
  })

  const createLocation = useMutation({
    mutationFn: (values: CreateLocationBody) => post<LocationDetail>('/locations', values),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      toast.success('Location created')
      router.push(`/locations/${res.data.id}`)
    },
    onError: showApiErrorToast,
  })

  const onSubmit = (values: CreateLocationBody) => {
    createLocation.mutate({ ...values, phone: values.phone || undefined })
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Add Location" description="Create a new venue location" />
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Main Arena" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Galle Road" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Colombo" {...field} />
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
                      <FormLabel>Phone (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="+94 11 234 5678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <FormControl>
                      <Input placeholder="Asia/Colombo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={createLocation.isPending}>
                {createLocation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Location
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
