'use client'

import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UpdateHoursBodySchema, type UpdateHoursBody } from '@sports-booking/types'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { put, showApiErrorToast } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { LocationDetail } from '@/hooks/useLocations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Form } from '@/components/ui/form'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface HoursTabProps {
  location: LocationDetail
}

export function HoursTab({ location }: HoursTabProps) {
  const actor = useAuthStore((state) => state.actor)
  const queryClient = useQueryClient()
  const canWrite = actor?.permissions.includes('locations.write') ?? false

  const defaultHours = Array.from({ length: 7 }, (_, day) => {
    const existing = location.operating_hours.find((h) => h.day_of_week === day)
    return {
      day_of_week: day,
      open_time: existing?.open_time ?? '09:00',
      close_time: existing?.close_time ?? '21:00',
      is_closed: existing?.is_closed ?? false,
    }
  })

  const form = useForm<UpdateHoursBody>({
    resolver: zodResolver(UpdateHoursBodySchema),
    defaultValues: { hours: defaultHours },
  })

  const { fields } = useFieldArray({ control: form.control, name: 'hours' })
  const hoursValues = useWatch({ control: form.control, name: 'hours' }) ?? defaultHours

  const updateHours = useMutation({
    mutationFn: (values: UpdateHoursBody) => put(`/locations/${location.id}/hours`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations', location.id] })
      toast.success('Operating hours updated')
    },
    onError: showApiErrorToast,
  })

  const onSubmit = (values: UpdateHoursBody) => {
    updateHours.mutate(values)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operating Hours</CardTitle>
        <CardDescription>Set opening and closing times for each day of the week</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            {fields.map((field, index) => {
              const isClosed = hoursValues[index]?.is_closed ?? false
              return (
                <div key={field.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                  <span className="w-28 font-medium">{DAY_NAMES[field.day_of_week]}</span>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={isClosed}
                      disabled={!canWrite}
                      onCheckedChange={(checked) => form.setValue(`hours.${index}.is_closed`, checked === true)}
                    />
                    Closed
                  </label>
                  <Input
                    type="time"
                    className="w-32"
                    disabled={!canWrite || isClosed}
                    {...form.register(`hours.${index}.open_time`)}
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    className="w-32"
                    disabled={!canWrite || isClosed}
                    {...form.register(`hours.${index}.close_time`)}
                  />
                </div>
              )
            })}
            {canWrite && (
              <Button type="submit" disabled={updateHours.isPending}>
                {updateHours.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Hours
              </Button>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
