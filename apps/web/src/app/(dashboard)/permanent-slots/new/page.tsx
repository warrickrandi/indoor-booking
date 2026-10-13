'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useLocations } from '@/hooks/useLocations'
import { useSubVenues } from '@/hooks/useSubVenues'
import { WEEKDAY_LABELS, useCreateRecurringRequest } from '@/hooks/useRecurringRequests'
import { showApiErrorToast } from '@/lib/api'
import { addDaysToDateString, todayDateString } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PageHeader } from '@/components/shared/PageHeader'

const FormSchema = z
  .object({
    sub_venue_id: z.string().uuid('Select a court'),
    day_of_week: z.string().min(1, 'Select a day'),
    start_time: z.string().min(1, 'Required'),
    end_time: z.string().min(1, 'Required'),
    start_date: z.string().min(1, 'Required'),
    end_date: z.string().min(1, 'Required'),
    full_name: z.string().min(1, 'Name is required'),
    email: z.string().email('Enter a valid email'),
    phone: z.string().min(1, 'Phone number is required'),
    notes: z.string().optional(),
  })
  .refine((v) => v.end_time === '00:00' || v.end_time > v.start_time, {
    message: 'End time must be after start time',
    path: ['end_time'],
  })
  .refine((v) => v.end_date >= v.start_date, { message: 'End date must be after start date', path: ['end_date'] })

type FormValues = z.infer<typeof FormSchema>

export default function NewPermanentSlotPage() {
  const router = useRouter()
  const [locationId, setLocationId] = useState('')
  const locations = useLocations()
  const subVenues = useSubVenues(locationId || undefined)
  const createRequest = useCreateRecurringRequest()

  const today = todayDateString()
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      sub_venue_id: '',
      day_of_week: '',
      start_time: '18:00',
      end_time: '19:00',
      start_date: today,
      end_date: addDaysToDateString(today, 90),
      full_name: '',
      email: '',
      phone: '',
      notes: '',
    },
  })

  const onSubmit = (values: FormValues) => {
    createRequest.mutate(
      {
        sub_venue_id: values.sub_venue_id,
        day_of_week: Number(values.day_of_week),
        start_time: values.start_time,
        end_time: values.end_time,
        start_date: values.start_date,
        end_date: values.end_date,
        notes: values.notes || undefined,
        customer_info: { full_name: values.full_name, email: values.email, phone: values.phone },
      },
      {
        onSuccess: (res) => {
          toast.success('Permanent slot created — review availability and approve it')
          router.push(`/permanent-slots/${res.data.id}`)
        },
        onError: showApiErrorToast,
      },
    )
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New Permanent Slot"
        description="Set up a weekly booking for a customer. You'll see which weeks are free before confirming."
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Weekly slot</CardTitle>
              <CardDescription>The start and end time must line up with the court&apos;s slot times.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select
                  value={locationId}
                  onValueChange={(value) => {
                    setLocationId(value)
                    form.setValue('sub_venue_id', '')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {(locations.data ?? []).map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormField
                control={form.control}
                name="sub_venue_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Court / Sub-venue</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={!locationId}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a court" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(subVenues.data ?? []).map((subVenue) => (
                          <SelectItem key={subVenue.id} value={subVenue.id}>
                            {subVenue.name}
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
                name="day_of_week"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of week</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a day" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WEEKDAY_LABELS.map((label, index) => (
                          <SelectItem key={label} value={String(index)}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="start_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From</FormLabel>
                      <FormControl>
                        <Input type="time" step={1800} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="end_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To</FormLabel>
                      <FormControl>
                        <Input type="time" step={1800} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starting from</FormLabel>
                    <FormControl>
                      <Input type="date" min={today} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Until</FormLabel>
                    <FormControl>
                      <Input type="date" min={today} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Team name, agreed rate, payment terms…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={createRequest.isPending}>
              {createRequest.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue to review
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
