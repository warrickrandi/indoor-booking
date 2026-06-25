'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { CustomerInfoSchema, type CustomerInfo } from '@sports-booking/types'
import { ChevronLeft, Loader2 } from 'lucide-react'

import { ApiError, mpPost } from '@/lib/marketplace-api'
import { showApiErrorToast } from '@/lib/api'
import { setPlayerSession } from '@/lib/player-auth'
import { usePlayerAuthStore, type PlayerCustomer } from '@/store/player-auth.store'
import { cn, formatDate, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { BookingSteps } from '@/components/marketplace/BookingSteps'
import { CountdownTimer } from '@/components/marketplace/CountdownTimer'
import { PriceDisplay } from '@/components/marketplace/PriceDisplay'

const PAYMENT_METHODS = [
  {
    value: 'online' as const,
    label: 'Pay online',
    description: 'Pay securely now via card or mobile wallet (PayHere).',
  },
  {
    value: 'bank_transfer' as const,
    label: 'Bank transfer',
    description: "Transfer to the venue's bank account and upload your payment slip.",
  },
]

type MarketplacePaymentMethod = (typeof PAYMENT_METHODS)[number]['value']

export interface SlotDetail {
  slotId: string
  sub_venue_id: string
  start_time: string
  end_time: string
  price: number
  rate_type: string
  status: string
  sub_venue: {
    name: string
    sport_type: string
    location: {
      name: string
      city: string
      company: {
        name: string
        slug: string
        branding: { primary_color: string; secondary_color: string; logo_url: string | null } | null
      }
    }
  }
}

interface LockResult {
  slotId: string
  lockToken: string
  expiresAt: string
}

interface BookingResult {
  booking: {
    id: string
    booking_ref: string
    status: string
    payment_method: string
    total_amount: number
    currency: string
  }
}

interface RegisterResult {
  access_token: string
  customer: PlayerCustomer
}

interface InitiatePaymentResult {
  checkout_url: string
  checkout_params: Record<string, string>
}

interface BookingWizardProps {
  slot: SlotDetail
}

export function BookingWizard({ slot }: BookingWizardProps) {
  const router = useRouter()
  const isAuthenticated = usePlayerAuthStore((state) => state.isAuthenticated)
  const customer = usePlayerAuthStore((state) => state.customer)
  const setStoreSession = usePlayerAuthStore((state) => state.setSession)

  const venueSlug = slot.sub_venue.location.company.slug
  const venueName = slot.sub_venue.location.company.name
  const subVenueLabel = `${slot.sub_venue.name} · ${slot.sub_venue.location.name}, ${slot.sub_venue.location.city}`

  const [step, setStep] = useState<'lock' | 'details' | 'review'>('lock')
  const [lock, setLock] = useState<LockResult | null>(null)
  const [lockError, setLockError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [authExpired, setAuthExpired] = useState(false)
  const [conflictEmail, setConflictEmail] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<MarketplacePaymentMethod>('online')
  const [notes, setNotes] = useState('')
  const [checkout, setCheckout] = useState<InitiatePaymentResult | null>(null)

  const checkoutFormRef = useRef<HTMLFormElement>(null)
  const lockAttempted = useRef(false)

  const guestForm = useForm<CustomerInfo>({
    resolver: zodResolver(CustomerInfoSchema),
    defaultValues: { full_name: '', email: '', phone: '' },
  })

  const lockMutation = useMutation({
    mutationFn: () => mpPost<LockResult>(`/slots/${slot.slotId}/lock`),
    onSuccess: ({ data }) => {
      setLock(data)
      setStep('details')
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setLockError('This slot is no longer available.')
      } else {
        setLockError('Something went wrong while reserving this slot. Please try again.')
      }
    },
  })

  useEffect(() => {
    if (lockAttempted.current) return
    lockAttempted.current = true

    if (slot.status !== 'available') {
      setLockError('This slot is no longer available.')
      return
    }
    lockMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const registerGuestMutation = useMutation({
    mutationFn: (values: CustomerInfo) =>
      mpPost<RegisterResult>('/marketplace/customers/register', { ...values, password: crypto.randomUUID() }),
    onSuccess: ({ data }) => {
      setPlayerSession({ access_token: data.access_token })
      setStoreSession({ customer: data.customer })
      setConflictEmail(null)
      setStep('review')
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflictEmail(guestForm.getValues('email'))
      } else {
        showApiErrorToast(err)
      }
    },
  })

  const initiatePaymentMutation = useMutation({
    mutationFn: (bookingId: string) =>
      mpPost<InitiatePaymentResult>('/payments/initiate', { booking_id: bookingId }, { requireAuth: true }),
    onSuccess: ({ data }) => {
      setCheckout(data)
    },
    onError: (err, bookingId) => {
      showApiErrorToast(err)
      router.push(`/bookings/${bookingId}/confirmation`)
    },
  })

  const createBookingMutation = useMutation({
    mutationFn: () => {
      if (!lock) throw new Error('No active reservation')
      return mpPost<BookingResult>(
        '/bookings',
        { slot_id: lock.slotId, lock_token: lock.lockToken, payment_method: paymentMethod, notes: notes || undefined },
        { requireAuth: true },
      )
    },
    onSuccess: ({ data }) => {
      if (paymentMethod === 'online') {
        initiatePaymentMutation.mutate(data.booking.id)
      } else {
        router.push(`/bookings/${data.booking.id}/confirmation`)
      }
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        setAuthExpired(true)
      } else {
        showApiErrorToast(err)
      }
    },
  })

  useEffect(() => {
    if (checkout && checkoutFormRef.current) {
      checkoutFormRef.current.submit()
    }
  }, [checkout])

  const handleGuestSubmit = (values: CustomerInfo) => {
    registerGuestMutation.mutate(values)
  }

  const dateLabel = formatDate(slot.start_time)
  const timeLabel = `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`
  const isConfirming = createBookingMutation.isPending || initiatePaymentMutation.isPending

  if (lockError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="mb-2 text-xl font-semibold">{lockError}</h1>
        <p className="mb-6 text-muted-foreground">Please choose another time slot.</p>
        <Button asChild>
          <Link href={`/venues/${venueSlug}`}>
            <ChevronLeft className="h-4 w-4" />
            Back to venue
          </Link>
        </Button>
      </div>
    )
  }

  if (step === 'lock') {
    return <LoadingPanel className="py-24" />
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/venues/${venueSlug}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to {venueName}
      </Link>

      <BookingSteps current={step === 'details' ? 2 : 3} />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{subVenueLabel}</CardTitle>
          <CardDescription>
            {dateLabel} &middot; {timeLabel}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-2">
          <PriceDisplay amount={slot.price} className="text-lg" />
          {lock && (
            <p className="text-sm text-muted-foreground">
              Reservation expires in <CountdownTimer expiresAt={lock.expiresAt} onExpire={() => setExpired(true)} />
            </p>
          )}
        </CardContent>
      </Card>

      {step === 'details' && (
        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
            {!isAuthenticated && (
              <CardDescription>Continue as a guest, or sign in if you already have an account.</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {isAuthenticated ? (
              <div className="rounded-md border bg-muted/50 p-3 text-sm">
                <p className="font-medium">{customer?.full_name}</p>
                <p className="text-muted-foreground">{customer?.email}</p>
              </div>
            ) : (
              <Form {...guestForm}>
                <form id="guest-form" onSubmit={guestForm.handleSubmit(handleGuestSubmit)} className="space-y-4">
                  <FormField
                    control={guestForm.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={guestForm.control}
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
                      control={guestForm.control}
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
                  </div>
                </form>
              </Form>
            )}

            {conflictEmail && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                You&apos;ve booked with us before &mdash;{' '}
                <Link href={`/player/login?redirect=/book/${slot.slotId}`} className="font-medium underline">
                  sign in to continue
                </Link>
                .
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Payment method</p>
              {PAYMENT_METHODS.map((method) => (
                <label
                  key={method.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors',
                    paymentMethod === method.value ? 'border-primary bg-primary/5' : 'border-input',
                  )}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={method.value}
                    checked={paymentMethod === method.value}
                    onChange={() => setPaymentMethod(method.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">{method.label}</span>
                    <span className="block text-muted-foreground">{method.description}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Notes (optional)</p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the venue should know"
              />
            </div>

            {isAuthenticated ? (
              <Button onClick={() => setStep('review')} className="w-full">
                Continue
              </Button>
            ) : (
              <Button type="submit" form="guest-form" disabled={registerGuestMutation.isPending} className="w-full">
                {registerGuestMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'review' && (
        <Card>
          <CardHeader>
            <CardTitle>Review &amp; confirm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <dt className="text-muted-foreground">Venue</dt>
                <dd className="sm:text-right">{venueName}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <dt className="text-muted-foreground">Court</dt>
                <dd className="sm:text-right">{subVenueLabel}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <dt className="text-muted-foreground">Date &amp; time</dt>
                <dd className="sm:text-right">
                  {dateLabel}, {timeLabel}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="sm:text-right">{customer?.full_name ?? guestForm.getValues('full_name')}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="sm:text-right">{customer?.email ?? guestForm.getValues('email')}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <dt className="text-muted-foreground">Payment method</dt>
                <dd className="sm:text-right">{PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label}</dd>
              </div>
              <div className="flex flex-col gap-0.5 border-t pt-2 font-medium sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <dt>Total</dt>
                <dd className="sm:text-right">
                  <PriceDisplay amount={slot.price} />
                </dd>
              </div>
            </dl>

            {authExpired && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Your session has expired &mdash;{' '}
                <Link href={`/player/login?redirect=/book/${slot.slotId}`} className="font-medium underline">
                  please sign in again
                </Link>{' '}
                to complete your booking.
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setStep('details')} disabled={isConfirming}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button className="sm:flex-1" onClick={() => createBookingMutation.mutate()} disabled={isConfirming}>
                {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm booking
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {checkout && (
        <form ref={checkoutFormRef} method="POST" action={checkout.checkout_url} className="hidden">
          {Object.entries(checkout.checkout_params).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        </form>
      )}

      <Dialog open={expired} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your reservation has expired</DialogTitle>
            <DialogDescription>We could only hold this slot for 10 minutes. Please pick a slot again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => router.push(`/venues/${venueSlug}`)}>Back to venue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
