'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreateHolidayBodySchema, type CreateHolidayBody } from '@sports-booking/types'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { post, del, showApiErrorToast } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { formatDate } from '@/lib/utils'
import type { LocationDetail } from '@/hooks/useLocations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { EmptyState } from '@/components/shared/EmptyState'

interface HolidaysTabProps {
  location: LocationDetail
}

const DEFAULT_VALUES: CreateHolidayBody = {
  holiday_date: '',
  label: '',
  full_day: true,
  custom_open: undefined,
  custom_close: undefined,
}

export function HolidaysTab({ location }: HolidaysTabProps) {
  const actor = useAuthStore((state) => state.actor)
  const queryClient = useQueryClient()
  const canWrite = actor?.permissions.includes('locations.write') ?? false
  const [open, setOpen] = useState(false)

  const form = useForm<CreateHolidayBody>({
    resolver: zodResolver(CreateHolidayBodySchema),
    defaultValues: DEFAULT_VALUES,
  })

  const fullDay = form.watch('full_day')

  const createHoliday = useMutation({
    mutationFn: (values: CreateHolidayBody) => post(`/locations/${location.id}/holidays`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations', location.id] })
      toast.success('Holiday added')
      form.reset(DEFAULT_VALUES)
      setOpen(false)
    },
    onError: showApiErrorToast,
  })

  const deleteHoliday = useMutation({
    mutationFn: (holidayId: string) => del(`/locations/${location.id}/holidays/${holidayId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations', location.id] })
      toast.success('Holiday removed')
    },
    onError: showApiErrorToast,
  })

  const onSubmit = (values: CreateHolidayBody) => {
    createHoliday.mutate(
      values.full_day ? { ...values, custom_open: undefined, custom_close: undefined } : values,
    )
  }

  const holidays = [...location.holidays].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Holidays &amp; Closures</CardTitle>
          <CardDescription>Dates this location is closed or has special hours</CardDescription>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Add Holiday
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Holiday</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="holiday_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Label</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Poya Day" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="full_day"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => field.onChange(checked === true)}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Closed all day</FormLabel>
                      </FormItem>
                    )}
                  />
                  {!fullDay && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="custom_open"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Open Time</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="custom_close"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Close Time</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="submit" disabled={createHoliday.isPending}>
                      {createHoliday.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Add Holiday
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {holidays.length === 0 ? (
          <EmptyState
            title="No holidays added"
            description="Add dates when this location is closed or has special hours."
          />
        ) : (
          <ul className="divide-y">
            {holidays.map((holiday) => (
              <li key={holiday.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{holiday.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(`${holiday.holiday_date}T00:00:00`)}
                    {holiday.full_day ? ' · Closed all day' : ` · ${holiday.custom_open} - ${holiday.custom_close}`}
                  </p>
                </div>
                {canWrite && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={deleteHoliday.isPending}
                    onClick={() => {
                      if (window.confirm(`Remove holiday "${holiday.label}"?`)) {
                        deleteHoliday.mutate(holiday.id)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
