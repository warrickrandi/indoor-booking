'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UpdateLocationBodySchema, type UpdateLocationBody } from '@sports-booking/types'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { put, del, showApiErrorToast } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { LocationDetail } from '@/hooks/useLocations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

interface DetailsTabProps {
  location: LocationDetail
}

export function DetailsTab({ location }: DetailsTabProps) {
  const actor = useAuthStore((state) => state.actor)
  const queryClient = useQueryClient()
  const canWrite = actor?.permissions.includes('locations.write') ?? false
  const canDelete = actor?.permissions.includes('locations.delete') ?? false

  const form = useForm<UpdateLocationBody>({
    resolver: zodResolver(UpdateLocationBodySchema),
    defaultValues: {
      name: location.name,
      address: location.address,
      city: location.city,
      timezone: location.timezone,
      phone: location.phone ?? '',
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['locations'] })
    queryClient.invalidateQueries({ queryKey: ['locations', location.id] })
  }

  const updateLocation = useMutation({
    mutationFn: (values: UpdateLocationBody) => put(`/locations/${location.id}`, values),
    onSuccess: () => {
      invalidate()
      toast.success('Location updated')
    },
    onError: showApiErrorToast,
  })

  const deactivateLocation = useMutation({
    mutationFn: () => del(`/locations/${location.id}`),
    onSuccess: () => {
      invalidate()
      toast.success('Location deactivated')
    },
    onError: showApiErrorToast,
  })

  const reactivateLocation = useMutation({
    mutationFn: () => put(`/locations/${location.id}`, { status: 'active' }),
    onSuccess: () => {
      invalidate()
      toast.success('Location reactivated')
    },
    onError: showApiErrorToast,
  })

  const onSubmit = (values: UpdateLocationBody) => {
    updateLocation.mutate({ ...values, phone: values.phone || undefined })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Location Details</CardTitle>
          <CardDescription>Basic information shown to staff and customers</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!canWrite} />
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
                      <Input {...field} disabled={!canWrite} />
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
                        <Input {...field} disabled={!canWrite} />
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
                        <Input {...field} disabled={!canWrite} />
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
                      <Input {...field} disabled={!canWrite} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {canWrite && (
                <Button type="submit" disabled={updateLocation.isPending}>
                  {updateLocation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      {canDelete && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">
              {location.status === 'active' ? 'Deactivate Location' : 'Reactivate Location'}
            </CardTitle>
            <CardDescription>
              {location.status === 'active'
                ? 'This location will be hidden from the marketplace and staff. This can be reversed later.'
                : 'This location is currently inactive and hidden from the marketplace.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {location.status === 'active' ? (
              <Button
                variant="destructive"
                disabled={deactivateLocation.isPending}
                onClick={() => {
                  if (window.confirm(`Deactivate ${location.name}? It will no longer be visible to customers.`)) {
                    deactivateLocation.mutate()
                  }
                }}
              >
                {deactivateLocation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Deactivate Location
              </Button>
            ) : (
              <Button disabled={reactivateLocation.isPending} onClick={() => reactivateLocation.mutate()}>
                {reactivateLocation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Reactivate Location
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
