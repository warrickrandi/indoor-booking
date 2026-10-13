'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarClock, CheckCircle2, Loader2, MessageCircle, Phone } from 'lucide-react'

import { usePlayerAuthStore } from '@/store/player-auth.store'
import { WEEKDAY_LABELS, describeRecurringSlot, useSubmitRecurringRequest } from '@/hooks/useRecurringRequests'
import { showApiErrorToast } from '@/lib/api'
import { addDaysToDateString, todayDateString } from '@/lib/utils'

interface ContactLocation {
  name: string
  city: string
  phone: string | null
}

interface CourtOption {
  id: string
  name: string
  location_name: string
}

interface PermanentBookingCardProps {
  venueName: string
  venueSlug: string
  locations: ContactLocation[]
  courts: CourtOption[]
}

const RequestFormSchema = z
  .object({
    sub_venue_id: z.string().uuid('Choose a court'),
    day_of_week: z.string().min(1, 'Choose a day'),
    start_time: z.string().min(1, 'Required'),
    end_time: z.string().min(1, 'Required'),
    start_date: z.string().min(1, 'Required'),
    end_date: z.string().min(1, 'Required'),
    notes: z.string().max(1000).optional(),
  })
  .refine((v) => v.end_time === '00:00' || v.end_time > v.start_time, {
    message: 'End time must be after start time',
    path: ['end_time'],
  })
  .refine((v) => v.end_date >= v.start_date, { message: 'Must be after the start date', path: ['end_date'] })

type RequestFormValues = z.infer<typeof RequestFormSchema>

/** Digits only, with Sri Lankan local numbers (07XXXXXXXX) converted to international form for WhatsApp. */
function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0') ? `94${digits.slice(1)}` : digits
}

const inputClass =
  'mt-1 block w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink'

/**
 * Lets a logged-in player ask for the same court at the same time every week. The request goes to
 * the venue's backoffice for review; once approved, every matching week is booked.
 */
export function PermanentBookingCard({ venueName, venueSlug, locations, courts }: PermanentBookingCardProps) {
  const contacts = locations.filter((location) => location.phone)
  const isAuthenticated = usePlayerAuthStore((state) => state.isAuthenticated)
  const [mounted, setMounted] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)
  const submit = useSubmitRecurringRequest()

  useEffect(() => setMounted(true), [])

  const today = todayDateString()
  const form = useForm<RequestFormValues>({
    resolver: zodResolver(RequestFormSchema),
    defaultValues: {
      sub_venue_id: courts.length === 1 ? courts[0]!.id : '',
      day_of_week: '',
      start_time: '18:00',
      end_time: '19:00',
      start_date: today,
      end_date: addDaysToDateString(today, 90),
      notes: '',
    },
  })
  const errors = form.formState.errors

  const onSubmit = (values: RequestFormValues) => {
    submit.mutate(
      {
        sub_venue_id: values.sub_venue_id,
        day_of_week: Number(values.day_of_week),
        start_time: values.start_time,
        end_time: values.end_time,
        start_date: values.start_date,
        end_date: values.end_date,
        notes: values.notes?.trim() || undefined,
      },
      {
        onSuccess: ({ data }) => {
          setSubmitted(describeRecurringSlot(data))
          form.reset()
        },
        onError: showApiErrorToast,
      },
    )
  }

  const renderForm = () => {
    if (!mounted) return null

    if (!isAuthenticated) {
      return (
        <div className="mt-5 rounded-2xl border bg-muted/40 p-4 text-sm">
          <Link
            href={`/player/login?redirect=/venues/${venueSlug}`}
            className="font-semibold underline underline-offset-4"
          >
            Log in
          </Link>{' '}
          to send {venueName} a permanent slot request. They&apos;ll review it and book every week for you.
        </div>
      )
    }

    if (submitted) {
      return (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Request sent — {submitted}</p>
            <p className="mt-1">
              {venueName} will review it. Track it under{' '}
              <Link href="/my-bookings" className="font-semibold underline underline-offset-4">
                My bookings
              </Link>
              .
            </p>
            <button type="button" className="mt-2 font-semibold underline" onClick={() => setSubmitted(null)}>
              Request another slot
            </button>
          </div>
        </div>
      )
    }

    return (
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">
          Court
          <select className={inputClass} {...form.register('sub_venue_id')}>
            <option value="">Choose a court</option>
            {courts.map((court) => (
              <option key={court.id} value={court.id}>
                {court.name} · {court.location_name}
              </option>
            ))}
          </select>
          {errors.sub_venue_id && <span className="text-xs text-destructive">{errors.sub_venue_id.message}</span>}
        </label>
        <label className="text-sm font-medium">
          Every
          <select className={inputClass} {...form.register('day_of_week')}>
            <option value="">Choose a day</option>
            {WEEKDAY_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
          {errors.day_of_week && <span className="text-xs text-destructive">{errors.day_of_week.message}</span>}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium">
            From
            <input type="time" step={1800} className={inputClass} {...form.register('start_time')} />
          </label>
          <label className="text-sm font-medium">
            To
            <input type="time" step={1800} className={inputClass} {...form.register('end_time')} />
            {errors.end_time && <span className="text-xs text-destructive">{errors.end_time.message}</span>}
          </label>
        </div>
        <label className="text-sm font-medium">
          Starting
          <input type="date" min={today} className={inputClass} {...form.register('start_date')} />
        </label>
        <label className="text-sm font-medium">
          Until
          <input type="date" min={today} className={inputClass} {...form.register('end_date')} />
          {errors.end_date && <span className="text-xs text-destructive">{errors.end_date.message}</span>}
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Anything the venue should know? (optional)
          <textarea
            rows={2}
            className={inputClass}
            placeholder="Team name, number of players…"
            {...form.register('notes')}
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submit.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-soft disabled:opacity-60"
          >
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Send request
          </button>
        </div>
      </form>
    )
  }

  return (
    <section className="mt-12 overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[auto_1fr]">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-volt">
          <CalendarClock className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold">Need a regular or permanent slot?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask {venueName} to hold the same court for you every week. Send a request and they&apos;ll confirm which
            weeks are booked.
          </p>

          {courts.length > 0 && renderForm()}

          {contacts.length > 0 && (
            <>
              <p className="mt-6 text-sm font-semibold">Prefer to talk first?</p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {contacts.map((location) => (
                  <li key={`${location.name}-${location.phone}`} className="rounded-2xl border bg-muted/40 p-4">
                    <p className="font-semibold">{location.name}</p>
                    <p className="text-xs text-muted-foreground">{location.city}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={`tel:${location.phone}`}
                        className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-soft"
                      >
                        <Phone className="h-4 w-4" />
                        {location.phone}
                      </a>
                      <a
                        href={`https://wa.me/${toWhatsAppNumber(location.phone as string)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-ink px-4 py-2 text-sm font-semibold transition-colors hover:bg-ink hover:text-white"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
