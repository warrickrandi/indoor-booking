'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Building2, CalendarCheck, MapPin, TrendingUp } from 'lucide-react'

import { useAdminStats } from '@/hooks/useAdmin'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

const TIER_COLORS: Record<string, string> = {
  basic: '#94a3b8',
  pro: '#3b82f6',
  elite: '#f59e0b',
}

export default function AdminStatsPage() {
  const stats = useAdminStats()

  return (
    <div>
      <PageHeader title="Platform Stats" description="Cross-tenant overview of the platform" />

      {stats.isLoading ? (
        <LoadingPanel />
      ) : stats.isError || !stats.data ? (
        <EmptyState title="Failed to load stats" description="Please try again." />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="rounded-full bg-primary/10 p-3">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Companies</p>
                  <p className="text-2xl font-bold">{stats.data.total_companies}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="rounded-full bg-primary/10 p-3">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Revenue This Month</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.data.total_revenue_this_month)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="rounded-full bg-primary/10 p-3">
                  <CalendarCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-2xl font-bold">{stats.data.total_bookings.all_time}</p>
                  <p className="text-xs text-muted-foreground">{stats.data.total_bookings.this_month} this month</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="rounded-full bg-primary/10 p-3">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Venues</p>
                  <p className="text-2xl font-bold">{stats.data.active_venues}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Companies by Tier</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(stats.data.companies_by_tier).map(([tier, count]) => ({
                          name: tier,
                          value: count,
                        }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry: { name: string; value: number }) => `${entry.name} (${entry.value})`}
                      >
                        {Object.keys(stats.data.companies_by_tier).map((tier) => (
                          <Cell key={tier} fill={TIER_COLORS[tier] ?? '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>New Signups (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-sm text-muted-foreground">
                  {stats.data.new_signups_last_30_days} new companies
                </p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.data.signups_by_day}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value: string) => formatDate(value)}
                        minTickGap={20}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip labelFormatter={(value: string) => formatDate(value)} />
                      <Bar dataKey="count" fill="#3b82f6" name="Signups" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
