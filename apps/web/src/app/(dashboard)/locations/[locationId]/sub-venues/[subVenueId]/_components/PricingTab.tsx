'use client'

import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { RATE_TYPES, SLOT_DURATIONS, type CreatePricingRuleBody } from '@sports-booking/types'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { post, put, del, showApiErrorToast } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { formatCurrency } from '@/lib/utils'
import type { PricingRule, SubVenueDetail } from '@/hooks/useSubVenues'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { EmptyState } from '@/components/shared/EmptyState'

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const RATE_TYPE_LABELS: Record<string, string> = {
  peak: 'Peak',
  off_peak: 'Off-Peak',
  flat: 'Flat',
  weekend: 'Weekend',
}

const PricingRuleFormSchema = z
  .object({
    rule_name: z.string().min(1, 'Rule name is required'),
    rate_type: z.enum(RATE_TYPES),
    price_per_slot: z.string().min(1, 'Price is required'),
    slot_duration_mins: z.enum(['60', '90', '120']),
    peak_start: z.string().optional(),
    peak_end: z.string().optional(),
    applicable_days: z.array(z.number().int().min(0).max(6)).min(1, 'Select at least one day'),
    valid_from: z.string().optional(),
    valid_until: z.string().optional(),
  })
  .refine(
    (data) =>
      (data.rate_type !== 'peak' && data.rate_type !== 'off_peak') || (!!data.peak_start && !!data.peak_end),
    { message: 'Peak start and end times are required for this rate type', path: ['peak_start'] },
  )

type PricingRuleFormValues = z.infer<typeof PricingRuleFormSchema>

function ruleToFormValues(rule?: PricingRule): PricingRuleFormValues {
  return {
    rule_name: rule?.rule_name ?? '',
    rate_type: (rule?.rate_type as (typeof RATE_TYPES)[number]) ?? 'flat',
    price_per_slot: rule ? String(rule.price_per_slot) : '',
    slot_duration_mins: rule ? (String(rule.slot_duration_mins) as '60' | '90' | '120') : '60',
    peak_start: rule?.peak_start ?? undefined,
    peak_end: rule?.peak_end ?? undefined,
    applicable_days: rule?.applicable_days ?? [],
    valid_from: rule?.valid_from ?? undefined,
    valid_until: rule?.valid_until ?? undefined,
  }
}

function formatDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b)
  if (sorted.length === 7) return 'Every day'
  if (sorted.length === 5 && sorted.join(',') === '1,2,3,4,5') return 'Weekdays'
  if (sorted.length === 2 && sorted.join(',') === '0,6') return 'Weekends'
  return sorted.map((d) => DAY_ABBR[d]).join(', ')
}

interface PricingRuleDialogProps {
  locationId: string
  subVenueId: string
  rule?: PricingRule
  trigger: React.ReactNode
}

function PricingRuleDialog({ locationId, subVenueId, rule, trigger }: PricingRuleDialogProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const isEdit = !!rule

  const form = useForm<PricingRuleFormValues>({
    resolver: zodResolver(PricingRuleFormSchema),
    defaultValues: ruleToFormValues(rule),
  })

  const rateType = useWatch({ control: form.control, name: 'rate_type' })
  const showPeakFields = rateType === 'peak' || rateType === 'off_peak'

  const saveRule = useMutation({
    mutationFn: (values: CreatePricingRuleBody) =>
      isEdit
        ? put(`/locations/${locationId}/sub-venues/${subVenueId}/pricing/${rule.id}`, values)
        : post(`/locations/${locationId}/sub-venues/${subVenueId}/pricing`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-venues', locationId, subVenueId] })
      toast.success(isEdit ? 'Pricing rule updated' : 'Pricing rule added')
      setOpen(false)
    },
    onError: showApiErrorToast,
  })

  const onSubmit = (values: PricingRuleFormValues) => {
    saveRule.mutate({
      rule_name: values.rule_name,
      rate_type: values.rate_type,
      price_per_slot: Number(values.price_per_slot),
      slot_duration_mins: Number(values.slot_duration_mins) as 60 | 90 | 120,
      peak_start: showPeakFields ? values.peak_start : undefined,
      peak_end: showPeakFields ? values.peak_end : undefined,
      applicable_days: values.applicable_days,
      valid_from: values.valid_from || undefined,
      valid_until: values.valid_until || undefined,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) form.reset(ruleToFormValues(rule))
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Pricing Rule' : 'Add Pricing Rule'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="rule_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Weekday Evening" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="rate_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RATE_TYPES.map((rateTypeOption) => (
                          <SelectItem key={rateTypeOption} value={rateTypeOption}>
                            {RATE_TYPE_LABELS[rateTypeOption]}
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
                name="slot_duration_mins"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slot Duration</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SLOT_DURATIONS.map((duration) => (
                          <SelectItem key={duration} value={String(duration)}>
                            {duration} min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="price_per_slot"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price per Slot (LKR)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" placeholder="2000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {showPeakFields && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="peak_start"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peak Start</FormLabel>
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
                  name="peak_end"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peak End</FormLabel>
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
            <FormField
              control={form.control}
              name="applicable_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Applicable Days</FormLabel>
                  <div className="flex flex-wrap gap-3">
                    {DAY_ABBR.map((label, day) => (
                      <label key={day} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={field.value.includes(day)}
                          onCheckedChange={(checked) => {
                            field.onChange(
                              checked === true
                                ? [...field.value, day].sort((a, b) => a - b)
                                : field.value.filter((d) => d !== day),
                            )
                          }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="valid_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid From (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
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
                name="valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid Until (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveRule.isPending}>
                {saveRule.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? 'Save Changes' : 'Add Rule'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

interface PricingTabProps {
  locationId: string
  subVenue: SubVenueDetail
}

export function PricingTab({ locationId, subVenue }: PricingTabProps) {
  const actor = useAuthStore((state) => state.actor)
  const canWrite = actor?.permissions.includes('pricing.write') ?? false
  const queryClient = useQueryClient()

  const deleteRule = useMutation({
    mutationFn: (ruleId: string) => del(`/locations/${locationId}/sub-venues/${subVenue.id}/pricing/${ruleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-venues', locationId, subVenue.id] })
      toast.success('Pricing rule removed')
    },
    onError: showApiErrorToast,
  })

  const rules = [...subVenue.pricing_rules].sort((a, b) => a.rule_name.localeCompare(b.rule_name))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Pricing Rules</CardTitle>
          <CardDescription>Rates applied when generating bookable slots</CardDescription>
        </div>
        {canWrite && (
          <PricingRuleDialog
            locationId={locationId}
            subVenueId={subVenue.id}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Add Rule
              </Button>
            }
          />
        )}
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <EmptyState title="No pricing rules" description="Add a pricing rule before generating slots." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Rate Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">
                    {rule.rule_name}
                    {(rule.rate_type === 'peak' || rule.rate_type === 'off_peak') &&
                      rule.peak_start &&
                      rule.peak_end && (
                        <span className="block text-xs text-muted-foreground">
                          {rule.peak_start} - {rule.peak_end}
                        </span>
                      )}
                  </TableCell>
                  <TableCell>{RATE_TYPE_LABELS[rule.rate_type] ?? rule.rate_type}</TableCell>
                  <TableCell>{formatCurrency(rule.price_per_slot)}</TableCell>
                  <TableCell>{rule.slot_duration_mins} min</TableCell>
                  <TableCell>{formatDays(rule.applicable_days)}</TableCell>
                  <TableCell>
                    <Badge variant={rule.is_active ? 'success' : 'secondary'}>
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <PricingRuleDialog
                          locationId={locationId}
                          subVenueId={subVenue.id}
                          rule={rule}
                          trigger={
                            <Button variant="ghost" size="icon">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deleteRule.isPending}
                          onClick={() => {
                            if (window.confirm(`Remove pricing rule "${rule.rule_name}"?`)) {
                              deleteRule.mutate(rule.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
