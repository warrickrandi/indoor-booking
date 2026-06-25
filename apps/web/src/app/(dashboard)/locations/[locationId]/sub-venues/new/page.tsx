'use client'

import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { SPORT_TYPES, type CreateSubVenueBody } from '@sports-booking/types'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { post, showApiErrorToast } from '@/lib/api'
import type { SubVenueDetail } from '@/hooks/useSubVenues'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PageHeader } from '@/components/shared/PageHeader'

const SPORT_LABELS: Record<string, string> = {
  futsal: 'Futsal',
  badminton: 'Badminton',
  cricket: 'Cricket',
  playhouse: 'Playhouse',
  other: 'Other',
}

const SubVenueFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sport_type: z.enum(SPORT_TYPES),
  description: z.string().optional(),
  capacity: z.string().optional(),
  display_order: z.string().optional(),
  amenities: z.string().optional(),
})

type SubVenueFormValues = z.infer<typeof SubVenueFormSchema>

export default function NewSubVenuePage() {
  const { locationId } = useParams<{ locationId: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const form = useForm<SubVenueFormValues>({
    resolver: zodResolver(SubVenueFormSchema),
    defaultValues: {
      name: '',
      sport_type: 'futsal',
      description: '',
      capacity: '',
      display_order: '',
      amenities: '',
    },
  })

  const createSubVenue = useMutation({
    mutationFn: (values: CreateSubVenueBody) =>
      post<SubVenueDetail>(`/locations/${locationId}/sub-venues`, values),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sub-venues', locationId] })
      toast.success('Sub-venue created')
      router.push(`/locations/${locationId}/sub-venues/${res.data.id}`)
    },
    onError: showApiErrorToast,
  })

  const onSubmit = (values: SubVenueFormValues) => {
    createSubVenue.mutate({
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
        : undefined,
    })
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Add Sub-Venue" description="Create a new court, field, or room for this location" />
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
                      <Input placeholder="Court 1" {...field} />
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
                    <Select value={field.value} onValueChange={field.onChange}>
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
                      <Textarea placeholder="Indoor 5-a-side futsal court with synthetic turf" {...field} />
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
                        <Input type="number" min="1" placeholder="10" {...field} />
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
                      <FormLabel>Display Order (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="0" {...field} />
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
                      <Input placeholder="Floodlights, Parking, Changing Rooms" {...field} />
                    </FormControl>
                    <FormDescription>Comma-separated list</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={createSubVenue.isPending}>
                {createSubVenue.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Sub-Venue
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
