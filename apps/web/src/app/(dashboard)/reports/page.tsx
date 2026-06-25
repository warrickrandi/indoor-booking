'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useAuthStore } from '@/store/auth.store'
import { useLocations } from '@/hooks/useLocations'
import {
  useDailySummary,
  useExportReport,
  useOccupancy,
  useRevenue,
  type OccupancyCell,
} from '@/hooks/useReports'
import { addDaysToDateString, formatCurrency, todayDateString } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

const MAX_HEATMAP_DAYS = 366

function LocationSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const locations = useLocations()

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Locations</SelectItem>
        {locations.data?.map((location) => (
          <SelectItem key={location.id} value={location.id}>
            {location.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default function ReportsPage() {
  const actor = useAuthStore((state) => state.actor)
  const canViewRevenue = actor?.permissions.includes('reports.full_ledger') ?? false

  return (
    <div>
      <PageHeader title="Reports" description="Operational and financial insights for your venues" />

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Daily Summary</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <DailySummaryTab />
        </TabsContent>

        <TabsContent value="revenue">
          {canViewRevenue ? (
            <RevenueTab />
          ) : (
            <EmptyState
              title="Upgrade to Pro"
              description="Revenue trends and CSV exports are available on Pro and Elite plans."
            />
          )}
        </TabsContent>

        <TabsContent value="occupancy">
          <OccupancyTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DailySummaryTab() {
  const [date, setDate] = useState(todayDateString())
  const [locationId, setLocationId] = useState('all')

  const summary = useDailySummary({ date, location_id: locationId === 'all' ? undefined : locationId })

  const totalBookings = summary.data?.bookings_by_status.reduce((sum, row) => sum + row.count, 0) ?? 0
  const totalRevenue = summary.data?.revenue_by_payment_method.reduce((sum, row) => sum + row.total, 0) ?? 0
  const avgOccupancy =
    summary.data && summary.data.occupancy.length > 0
      ? summary.data.occupancy.reduce((sum, row) => sum + row.occupancy_rate, 0) / summary.data.occupancy.length
      : 0

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[180px]" />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <LocationSelect value={locationId} onChange={setLocationId} />
          </div>
        </CardContent>
      </Card>

      {summary.isLoading ? (
        <LoadingPanel />
      ) : summary.isError || !summary.data ? (
        <EmptyState title="Failed to load report" description="Please try again." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totalBookings}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Verifications</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.data.pending_verifications}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Occupancy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{Math.round(avgOccupancy * 100)}%</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Bookings by Status</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.data.bookings_by_status.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings for this date.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {summary.data.bookings_by_status.map((row) => (
                    <Badge key={row.status} variant="outline">
                      {row.status.replace(/_/g, ' ')}: {row.count}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sub-Venue Occupancy</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.data.occupancy.length === 0 ? (
                <p className="text-sm text-muted-foreground">No slots scheduled for this date.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sub-Venue</TableHead>
                      <TableHead className="text-right">Total Slots</TableHead>
                      <TableHead className="text-right">Booked</TableHead>
                      <TableHead className="text-right">Occupancy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.data.occupancy.map((row) => (
                      <TableRow key={row.sub_venue_id}>
                        <TableCell className="font-medium">{row.sub_venue_name}</TableCell>
                        <TableCell className="text-right">{row.total_slots}</TableCell>
                        <TableCell className="text-right">{row.booked_slots}</TableCell>
                        <TableCell className="text-right">{Math.round(row.occupancy_rate * 100)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue by Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.data.revenue_by_payment_method.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments received for this date.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.data.revenue_by_payment_method.map((row) => (
                      <TableRow key={row.payment_method}>
                        <TableCell className="capitalize">{row.payment_method.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function RevenueTab() {
  const [fromDate, setFromDate] = useState(addDaysToDateString(todayDateString(), -29))
  const [toDate, setToDate] = useState(todayDateString())
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')

  const revenue = useRevenue({ from_date: fromDate, to_date: toDate, group_by: groupBy })
  const exportReport = useExportReport()

  const totals = (revenue.data?.by_period ?? []).reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      online: acc.online + row.online,
      bank_transfer: acc.bank_transfer + row.bank_transfer,
      pay_at_venue: acc.pay_at_venue + row.pay_at_venue,
    }),
    { total: 0, online: 0, bank_transfer: 0, pay_at_venue: 0 },
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1.5">
            <Label>From Date</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[180px]" />
          </div>
          <div className="space-y-1.5">
            <Label>To Date</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[180px]" />
          </div>
          <div className="space-y-1.5">
            <Label>Group By</Label>
            <Select value={groupBy} onValueChange={(value) => setGroupBy(value as 'day' | 'week' | 'month')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            className="sm:ml-auto"
            disabled={exportReport.isPending}
            onClick={() => exportReport.mutate({ type: 'transactions', from_date: fromDate, to_date: toDate })}
          >
            {exportReport.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export CSV
          </Button>
        </CardContent>
      </Card>

      {revenue.isLoading ? (
        <LoadingPanel />
      ) : revenue.isError || !revenue.data ? (
        <EmptyState title="Failed to load report" description="Please try again." />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Revenue Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {revenue.data.by_period.length === 0 ? (
                <p className="text-sm text-muted-foreground">No revenue in this date range.</p>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenue.data.by_period}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} />
                      <Line type="monotone" dataKey="online" name="Online" stroke="#22c55e" />
                      <Line type="monotone" dataKey="bank_transfer" name="Bank Transfer" stroke="#f59e0b" />
                      <Line type="monotone" dataKey="pay_at_venue" name="Pay at Venue" stroke="#a855f7" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue by Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Online</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.online)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Bank Transfer</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.bank_transfer)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Pay at Venue</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.pay_at_venue)}</TableCell>
                  </TableRow>
                  <TableRow className="font-medium">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {revenue.data.by_location.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Location</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenue.data.by_location.map((row) => (
                      <TableRow key={row.location_id}>
                        <TableCell>{row.location_name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Revenue by Sub-Venue</CardTitle>
            </CardHeader>
            <CardContent>
              {revenue.data.by_sub_venue.length === 0 ? (
                <p className="text-sm text-muted-foreground">No revenue in this date range.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sub-Venue</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenue.data.by_sub_venue.map((row) => (
                      <TableRow key={row.sub_venue_id}>
                        <TableCell>{row.sub_venue_name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function buildDateRange(fromDate: string, toDate: string): string[] {
  const dates: string[] = []
  let current = fromDate
  while (current <= toDate && dates.length < MAX_HEATMAP_DAYS) {
    dates.push(current)
    current = addDaysToDateString(current, 1)
  }
  return dates
}

function OccupancyTab() {
  const [fromDate, setFromDate] = useState(addDaysToDateString(todayDateString(), -6))
  const [toDate, setToDate] = useState(todayDateString())
  const [locationId, setLocationId] = useState('all')

  const occupancy = useOccupancy({
    from_date: fromDate,
    to_date: toDate,
    location_id: locationId === 'all' ? undefined : locationId,
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1.5">
            <Label>From Date</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[180px]" />
          </div>
          <div className="space-y-1.5">
            <Label>To Date</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[180px]" />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <LocationSelect value={locationId} onChange={setLocationId} />
          </div>
        </CardContent>
      </Card>

      {occupancy.isLoading ? (
        <LoadingPanel />
      ) : occupancy.isError || !occupancy.data ? (
        <EmptyState title="Failed to load report" description="Please try again." />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Occupancy Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              {occupancy.data.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">No slots scheduled in this date range.</p>
              ) : (
                <OccupancyHeatmap data={occupancy.data.data} fromDate={fromDate} toDate={toDate} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Peak Hours</CardTitle>
            </CardHeader>
            <CardContent>
              {occupancy.data.peak_hours.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings in this date range.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {occupancy.data.peak_hours.map((row) => (
                    <Badge key={row.hour} variant="outline">
                      {row.hour}:00 &mdash; {row.booking_count} {row.booking_count === 1 ? 'booking' : 'bookings'}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function OccupancyHeatmap({ data, fromDate, toDate }: { data: OccupancyCell[]; fromDate: string; toDate: string }) {
  const dates = buildDateRange(fromDate, toDate)

  const subVenues = new Map<string, string>()
  const cells = new Map<string, OccupancyCell>()
  for (const cell of data) {
    subVenues.set(cell.sub_venue_id, cell.sub_venue_name)
    cells.set(`${cell.sub_venue_id}_${cell.date}`, cell)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left font-medium text-muted-foreground">Sub-Venue</th>
            {dates.map((date) => (
              <th key={date} className="px-2 py-1 text-center font-medium text-muted-foreground">
                {date.slice(5)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from(subVenues.entries()).map(([subVenueId, subVenueName]) => (
            <tr key={subVenueId}>
              <td className="px-2 py-1 font-medium">{subVenueName}</td>
              {dates.map((date) => {
                const cell = cells.get(`${subVenueId}_${date}`)
                const rate = cell?.occupancy_rate ?? null
                return (
                  <td
                    key={date}
                    className="px-2 py-1 text-center"
                    style={rate !== null ? { backgroundColor: `hsl(var(--primary) / ${rate})` } : undefined}
                  >
                    {rate !== null ? `${Math.round(rate * 100)}%` : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
