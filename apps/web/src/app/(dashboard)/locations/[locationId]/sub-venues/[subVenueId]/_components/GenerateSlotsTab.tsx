'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { GenerateSlotsBodySchema } from '@sports-booking/types'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { post, showApiErrorToast } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { addDaysToDateString, formatDate, todayDateString } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

type GenerateSlotsFormValues = z.input<typeof GenerateSlotsBodySchema>

interface GenerateSlotsResult {
  generated: number
  skipped: number
  dates: { date: string; generated: number }[]
}

interface GenerateSlotsTabProps {
  locationId: string
  subVenueId: string
}

export function GenerateSlotsTab({ locationId, subVenueId }: GenerateSlotsTabProps) {
  const actor = useAuthStore((state) => state.actor)
  const canWrite = actor?.permissions.includes('slots.write') ?? false
  const queryClient = useQueryClient()
  const [result, setResult] = useState<GenerateSlotsResult | null>(null)

  const today = todayDateString()

  const form = useForm<GenerateSlotsFormValues>({
    resolver: zodResolver(GenerateSlotsBodySchema),
    defaultValues: { from_date: today, to_date: addDaysToDateString(today, 7), overwrite: false },
  })

  const generateSlots = useMutation({
    mutationFn: (values: GenerateSlotsFormValues) =>
      post<GenerateSlotsResult>(`/locations/${locationId}/sub-venues/${subVenueId}/slots/generate`, values),
    onSuccess: (res) => {
      setResult(res.data)
      queryClient.invalidateQueries({ queryKey: ['slot-calendar'] })
      toast.success(`Generated ${res.data.generated} slot${res.data.generated === 1 ? '' : 's'}`)
    },
    onError: showApiErrorToast,
  })

  const onSubmit = (values: GenerateSlotsFormValues) => {
    setResult(null)
    generateSlots.mutate(values)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Slots</CardTitle>
        <CardDescription>
          Create bookable time slots for a date range using this sub-venue&apos;s pricing rules. Existing slots are
          left as-is unless &quot;Overwrite&quot; is checked.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="from_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Date</FormLabel>
                    <FormControl>
                      <Input type="date" min={today} disabled={!canWrite} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="to_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Date</FormLabel>
                    <FormControl>
                      <Input type="date" min={today} disabled={!canWrite} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="overwrite"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value ?? false}
                      disabled={!canWrite}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Overwrite existing slots in this range</FormLabel>
                </FormItem>
              )}
            />
            <FormDescription>Date range cannot exceed 90 days, and must start within the next year.</FormDescription>
            {canWrite && (
              <Button type="submit" disabled={generateSlots.isPending}>
                {generateSlots.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Generate Slots
              </Button>
            )}
          </form>
        </Form>

        {result && (
          <div className="rounded-md border p-4">
            <p className="font-medium">
              Generated {result.generated} slot{result.generated === 1 ? '' : 's'}
              {result.skipped > 0 && ` · Skipped ${result.skipped} past date${result.skipped === 1 ? '' : 's'}`}
            </p>
            {result.dates.length > 0 && (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-muted-foreground">
                {result.dates.map((d) => (
                  <li key={d.date} className="flex justify-between">
                    <span>{formatDate(`${d.date}T00:00:00`)}</span>
                    <span>
                      {d.generated} slot{d.generated === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
