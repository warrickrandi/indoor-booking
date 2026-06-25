'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import {
  useAdminCompanyDetail,
  useAdminSubscriptionPlans,
  useUpdateCompanySubscription,
} from '@/hooks/useAdmin'
import { formatCurrency, formatDate, formatTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'

export default function AdminCompanyDetailPage() {
  const params = useParams<{ companyId: string }>()
  const companyId = params.companyId

  const company = useAdminCompanyDetail(companyId)
  const plans = useAdminSubscriptionPlans()
  const updateSubscription = useUpdateCompanySubscription(companyId)

  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)

  if (company.isLoading) {
    return <LoadingPanel />
  }

  if (company.isError || !company.data) {
    return <EmptyState title="Failed to load company" description="Please try again." />
  }

  const data = company.data
  const currentPlan = plans.data?.find((plan) => plan.name === data.plan.name)
  const pendingPlan = plans.data?.find((plan) => plan.id === pendingPlanId)

  return (
    <div>
      <PageHeader
        title={data.name}
        description={data.slug}
        action={<StatusBadge status={data.status} />}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Plan</p>
            <p className="font-medium capitalize">
              {data.plan.name} ({data.plan.tier})
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Billing Cycle</p>
            <p className="font-medium capitalize">{data.billing_cycle}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Trial Ends</p>
            <p className="font-medium">{data.trial_ends_at ? formatDate(data.trial_ends_at) : '—'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current Period End</p>
            <p className="font-medium">{data.current_period_end ? formatDate(data.current_period_end) : '—'}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Change Plan</Label>
            <Select
              value={currentPlan?.id ?? ''}
              onValueChange={(value) => {
                if (value !== currentPlan?.id) {
                  setPendingPlanId(value)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(plans.data ?? []).map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} ({plan.tier})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{data.status}</p>
            </div>
            <Switch
              checked={data.status === 'active'}
              disabled={updateSubscription.isPending}
              onCheckedChange={(checked) =>
                updateSubscription.mutate({ status: checked ? 'active' : 'suspended' })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={pendingPlanId !== null} onOpenChange={(open) => !open && setPendingPlanId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription>
              Change {data.name}&apos;s plan from {data.plan.name} to {pendingPlan?.name}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPlanId(null)}>
              Cancel
            </Button>
            <Button
              disabled={updateSubscription.isPending}
              onClick={() => {
                if (pendingPlanId) {
                  updateSubscription.mutate(
                    { plan_id: pendingPlanId },
                    { onSuccess: () => setPendingPlanId(null) },
                  )
                }
              }}
            >
              {updateSubscription.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members ({data.members.length})</TabsTrigger>
          <TabsTrigger value="locations">Locations ({data.locations.length})</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Company Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{data.phone ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Address</span>
                  <span>{data.address ?? '—'}</span>
                </div>
                {data.branding && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Primary Color</span>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: data.branding.primary_color ?? undefined }}
                        />
                        {data.branding.primary_color}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Secondary Color</span>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: data.branding.secondary_color ?? undefined }}
                        />
                        {data.branding.secondary_color}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {data.payment_summary.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payment transactions yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.payment_summary.map((row) => (
                        <TableRow key={row.status}>
                          <TableCell>
                            <StatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardContent className="pt-6">
              {data.members.length === 0 ? (
                <EmptyState title="No members" description="This company has no members yet." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Locations</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.user.full_name}</TableCell>
                          <TableCell>{member.user.email}</TableCell>
                          <TableCell>{member.role.display_name}</TableCell>
                          <TableCell>
                            {member.location_ids.length === 0 ? 'All locations' : member.location_ids.length}
                          </TableCell>
                          <TableCell>
                            <Badge variant={member.status === 'active' ? 'success' : 'secondary'}>
                              {member.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations">
          <Card>
            <CardContent className="pt-6">
              {data.locations.length === 0 ? (
                <EmptyState title="No locations" description="This company has no locations yet." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Sub-Venues</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.locations.map((location) => (
                        <TableRow key={location.id}>
                          <TableCell className="font-medium">{location.name}</TableCell>
                          <TableCell>{location.city ?? '—'}</TableCell>
                          <TableCell>
                            <StatusBadge status={location.status} />
                          </TableCell>
                          <TableCell className="text-right">{location.sub_venue_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings">
          <Card>
            <CardContent className="pt-6">
              {data.recent_bookings.length === 0 ? (
                <EmptyState title="No bookings" description="This company has no bookings yet." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Booking Ref</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Location / Sub-Venue</TableHead>
                        <TableHead>Date &amp; Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recent_bookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">{booking.booking_ref}</TableCell>
                          <TableCell>{booking.customer.full_name}</TableCell>
                          <TableCell>
                            <div>{booking.time_slot.sub_venue_name}</div>
                            <div className="text-xs text-muted-foreground">{booking.time_slot.location_name}</div>
                          </TableCell>
                          <TableCell>
                            <div>{formatDate(booking.time_slot.start_time)}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatTime(booking.time_slot.start_time)} - {formatTime(booking.time_slot.end_time)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={booking.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(booking.total_amount, booking.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Billing Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.billing ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contact Name</span>
                      <span>{data.billing.contact_name ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contact Email</span>
                      <span>{data.billing.contact_email ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contact Phone</span>
                      <span>{data.billing.contact_phone ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax ID</span>
                      <span>{data.billing.tax_id ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bank</span>
                      <span>{data.billing.bank_name ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bank Account</span>
                      <span>{data.billing.bank_account_number ?? '—'}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">No billing details on file.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscription Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {data.subscription_invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.subscription_invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell>
                            {formatDate(invoice.billing_period_start)} - {formatDate(invoice.billing_period_end)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={invoice.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(invoice.amount, invoice.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
