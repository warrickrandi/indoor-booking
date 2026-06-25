'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { SPORT_TYPES, type UpdateSubVenueBody } from '@sports-booking/types'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { put, del, showApiErrorToast } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { SubVenueDetail } from '@/hooks/useSubVenues'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const SPORT_LABELS: Record<string, string> = {
  futsal: 'Futsal',
  badminton: 'Badminton',
  cricket: 'Cricket',
  playhouse: 'Playhouse',
  other: 'Other',
}

const SubVenueDetailsFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sport_type: z.enum(SPORT_TYPES),
  description: z.string().optional(),
  capacity: z.string().optional(),
  display_order: z.string().optional(),
  amenities: z.string().optional(),
})

type SubVenueDetailsFormValues = z.infer<typeof SubVenueDetailsFormSchema>

interface DetailsTabProps {
  locationId: string
  subVenue: SubVenueDetail
}

export function DetailsTab({ locationId, subVenue }: DetailsTabProps) {
  const actor = useAuthStore((state) => state.actor)
  const queryClient = useQueryClient()
  const canWrite = actor?.permissions.includes('sub_venues.write') ?? false

  const form = useForm<SubVenueDetailsFormValues>({
    resolver: zodResolver(SubVenueDetailsFormSchema),
    defaultValues: {
      name: subVenue.name,
      sport_type: subVenue.sport_type as (typeof SPORT_TYPES)[number],
      description: subVenue.description ?? '',
      capacity: subVenue.capacity != null ? String(subVenue.capacity) : '',
      display_order: String(subVenue.display_order),
      amenities: subVenue.amenities.join(', '),
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sub-venues', locationId] })
    queryClient.invalidateQueries({ queryKey: ['sub-venues', locationId, subVenue.id] })
  }

  const updateSubVenue = useMutation({
    mutationFn: (values: UpdateSubVenueBody) => put(`/locations/${locationId}/sub-venues/${subVenue.id}`, values),
    onSuccess: () => {
      invalidate()
      toast.success('Sub-venue updated')
    },
    onError: showApiErrorToast,
  })

  const deactivateSubVenue = useMutation({
    mutationFn: () => del(`/locations/${locationId}/sub-venues/${subVenue.id}`),
    onSuccess: () => {
      invalidate()
      toast.success('Sub-venue deactivated')
    },
    onError: showApiErrorToast,
  })

  const reactivateSubVenue = useMutation({
    mutationFn: () => put(`/locations/${locationId}/sub-venues/${subVenue.id}`, { status: 'active' }),
    onSuccess: () => {
      invalidate()
      toast.success('Sub-venue reactivated')
    },
    onError: showApiErrorToast,
  })

  const onSubmit = (values: SubVenueDetailsFormValues) => {
    updateSubVenue.mutate({
      name: values.name,
      sport_type: values.sport_type,
      description: values.description || undefined,
      capacity: values.capacity ? Number(values.capacity) : undefined,
      display_order: values.display_order ? Number(values.display_order) : undefined,
      amenities: values.amenities
        ? values.amenities
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean)
        : [],
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sub-Venue Details</CardTitle>
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
                name="sport_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sport Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={!canWrite}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SPORT_TYPES.map((sport) => (
                          <SelectItem key={sport} value={sport}>
                            {SPORT_LABELS[sport]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} disabled={!canWrite} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} disabled={!canWrite} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="display_order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Order</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} disabled={!canWrite} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="amenities"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amenities (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!canWrite} />
                    </FormControl>
                    <FormDescription>Comma-separated list</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {canWrite && (
                <Button type="submit" disabled={updateSubVenue.isPending}>
                  {updateSubVenue.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      {canWrite && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">
              {subVenue.status === 'active' ? 'Deactivate Sub-Venue' : 'Reactivate Sub-Venue'}
            </CardTitle>
            <CardDescription>
              {subVenue.status === 'active'
                ? 'This sub-venue will be hidden from the marketplace and staff. This can be reversed later.'
                : 'This sub-venue is currently inactive and hidden from the marketplace.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subVenue.status === 'active' ? (
              <Button
                variant="destructive"
                disabled={deactivateSubVenue.isPending}
                onClick={() => {
                  if (window.confirm(`Deactivate ${subVenue.name}? It will no longer be visible to customers.`)) {
                    deactivateSubVenue.mutate()
                  }
                }}
              >
                {deactivateSubVenue.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Deactivate Sub-Venue
              </Button>
            ) : (
              <Button disabled={reactivateSubVenue.isPending} onClick={() => reactivateSubVenue.mutate()}>
                {reactivateSubVenue.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Reactivate Sub-Venue
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
