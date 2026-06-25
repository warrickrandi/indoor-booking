'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { PaymentMethodSchema, type CreateBookingBody } from '@sports-booking/types'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useLocations } from '@/hooks/useLocations'
import { useSubVenues } from '@/hooks/useSubVenues'
import { useSlots } from '@/hooks/useSlots'
import { post, showApiErrorToast } from '@/lib/api'
import { formatDate, todayDateString } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { SlotGrid, type SlotSummary } from '@/components/shared/SlotGrid'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  online: 'Online (PayHere)',
  bank_transfer: 'Bank Transfer',
  pay_at_venue: 'Pay at Venue',
}

const CustomerDetailsFormSchema = z.object({
  payment_method: PaymentMethodSchema,
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().min(1, 'Phone number is required'),
  notes: z.string().optional(),
})

type CustomerDetailsFormValues = z.infer<typeof CustomerDetailsFormSchema>

interface LockState {
  slotId: string
  lockToken: string
  expiresAt: string
  slot: SlotSummary
}

interface LockResult {
  slotId: string
  lockToken: string
  expiresAt: string
}

const LOCK_SECONDS = 600

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function NewBookingPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [step, setStep] = useState<'select' | 'slot' | 'details'>('select')
  const [locationId, setLocationId] = useState('')
  const [subVenueId, setSubVenueId] = useState('')
  const [date, setDate] = useState(todayDateString())
  const [lock, setLock] = useState<LockState | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(LOCK_SECONDS)

  const lockRef = useRef<LockState | null>(null)
  const confirmedRef = useRef(false)
  lockRef.current = lock

  const locations = useLocations()
  const subVenues = useSubVenues(locationId || undefined)
  const slots = useSlots(subVenueId || undefined, date || undefined)

  const form = useForm<CustomerDetailsFormValues>({
    resolver: zodResolver(CustomerDetailsFormSchema),
    defaultValues: { payment_method: 'pay_at_venue', full_name: '', email: '', phone: '', notes: '' },
  })

  useEffect(() => {
    return () => {
      if (lockRef.current && !confirmedRef.current) {
        post(`/slots/${lockRef.current.slotId}/unlock`, { lock_token: lockRef.current.lockToken }).catch(() => {})
      }
    }
  }, [])

  useEffect(() => {
    if (!lock) return

    const tick = () => {
      const remaining = Math.max(0, Math.round((Date.parse(lock.expiresAt) - Date.now()) / 1000))
      setRemainingSeconds(remaining)
      if (remaining <= 0) {
        toast.error('Slot lock expired. Please select a slot again.')
        setLock(null)
        setStep('slot')
        queryClient.invalidateQueries({ queryKey: ['slots', subVenueId, date] })
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [lock, subVenueId, date, queryClient])

  const lockSlot = useMutation({
    mutationFn: async (slot: SlotSummary) => {
      const res = await post<LockResult>(`/slots/${slot.slotId}/lock`)
      return { ...res.data, slot }
    },
    onSuccess: (result) => {
      setLock(result)
      setRemainingSeconds(LOCK_SECONDS)
      setStep('details')
    },
    onError: showApiErrorToast,
  })

  const unlockAndGoBack = async () => {
    if (lock) {
      try {
        await post(`/slots/${lock.slotId}/unlock`, { lock_token: lock.lockToken })
      } catch {
        // best effort
      }
      queryClient.invalidateQueries({ queryKey: ['slots', subVenueId, date] })
    }
    setLock(null)
    setStep('slot')
  }

  const createBooking = useMutation({
    mutationFn: (values: CustomerDetailsFormValues) => {
      if (!lock) throw new Error('No slot locked')
      const body: CreateBookingBody = {
        slot_id: lock.slotId,
        lock_token: lock.lockToken,
        payment_method: values.payment_method,
        customer_info: { full_name: values.full_name, email: values.email, phone: values.phone },
        notes: values.notes || undefined,
      }
      return post<{ booking: { id: string } }>('/bookings', body)
    },
    onSuccess: (res) => {
      confirmedRef.current = true
      toast.success('Booking created')
      router.push(`/bookings/${res.data.booking.id}`)
    },
    onError: showApiErrorToast,
  })

  const onLocationChange = (value: string) => {
    setLocationId(value)
    setSubVenueId('')
  }

  return (
    <div>
      <PageHeader title="New Booking" description="Create a booking on behalf of a customer" />

      {step === 'select' && (
        <Card>
          <CardHeader>
            <CardTitle>1. Select Location, Sub-Venue &amp; Date</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={onLocationChange}>
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
            <div className="space-y-1.5">
              <Label>Sub-Venue</Label>
              <Select value={subVenueId} onValueChange={setSubVenueId} disabled={!locationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a sub-venue" />
                </SelectTrigger>
                <SelectContent>
                  {(subVenues.data ?? []).map((subVenue) => (
                    <SelectItem key={subVenue.id} value={subVenue.id}>
                      {subVenue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                min={todayDateString()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <Button className="w-full sm:w-auto" disabled={!locationId || !subVenueId || !date} onClick={() => setStep('slot')}>
              Next: Choose Slot
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'slot' && (
        <Card>
          <CardHeader>
            <CardTitle>2. Select a Time Slot</CardTitle>
            <CardDescription>{formatDate(`${date}T00:00:00`)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {slots.isLoading ? (
              <LoadingPanel />
            ) : !slots.data || (slots.data.available.length === 0 && slots.data.locked.length === 0 && slots.data.booked.length === 0) ? (
              <EmptyState title="No slots available" description="Try a different date or sub-venue." />
            ) : (
              <SlotGrid
                available={slots.data.available}
                locked={slots.data.locked}
                booked={slots.data.booked}
                onSelect={(slot) => lockSlot.mutate(slot)}
              />
            )}
            {lockSlot.isPending && (
              <p className="text-sm text-muted-foreground">
                <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                Locking slot...
              </p>
            )}
            <Button variant="outline" onClick={() => setStep('select')} disabled={lockSlot.isPending}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'details' && lock && (
        <Card>
          <CardHeader>
            <CardTitle>3. Customer &amp; Payment Details</CardTitle>
            <CardDescription>
              Slot locked &mdash; expires in {formatCountdown(remainingSeconds)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-md border bg-muted/50 p-3 text-sm">
              <p className="font-medium">{formatDate(`${date}T00:00:00`)}</p>
              <p className="text-muted-foreground">
                {lock.slot.start_time.slice(11, 16)} - {lock.slot.end_time.slice(11, 16)} &middot; Rs{' '}
                {lock.slot.price.toFixed(0)}
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit((values) => createBooking.mutate(values))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PaymentMethodSchema.options.map((method) => (
                            <SelectItem key={method} value={method}>
                              {PAYMENT_METHOD_LABELS[method]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
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
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
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
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={unlockAndGoBack}
                    disabled={createBooking.isPending}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button type="submit" className="sm:flex-1" disabled={createBooking.isPending || remainingSeconds <= 0}>
                    {createBooking.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirm Booking
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
