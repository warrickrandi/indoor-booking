'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { useAdminCompanies } from '@/hooks/useAdmin'
import { formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
]

const TIER_OPTIONS = [
  { value: 'all', label: 'All Tiers' },
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'elite', label: 'Elite' },
]

const PAGE_LIMIT = 20

export default function AdminCompaniesPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [tier, setTier] = useState('all')
  const [page, setPage] = useState(1)

  const companies = useAdminCompanies({
    search: search || undefined,
    status: status === 'all' ? undefined : status,
    tier: tier === 'all' ? undefined : tier,
    page,
    limit: PAGE_LIMIT,
  })

  const rows = companies.data?.data ?? []
  const meta = companies.data?.meta
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1

  return (
    <div>
      <PageHeader title="Companies" description="All tenant companies on the platform" />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <Label>Search</Label>
            <Input
              placeholder="Search by name or owner email"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <div className="min-w-[160px] space-y-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px] space-y-1.5">
            <Label>Tier</Label>
            <Select
              value={tier}
              onValueChange={(value) => {
                setTier(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {companies.isLoading ? (
            <LoadingPanel />
          ) : companies.isError ? (
            <EmptyState title="Failed to load companies" description="Please try again." />
          ) : rows.length === 0 ? (
            <EmptyState title="No companies found" description="Try adjusting your filters." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Locations</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((company) => (
                      <TableRow
                        key={company.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/admin/companies/${company.id}`)}
                      >
                        <TableCell className="font-medium">
                          <div>{company.name}</div>
                          <div className="text-xs text-muted-foreground">{company.slug}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {company.tier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={company.subscription_status} />
                        </TableCell>
                        <TableCell className="text-right">{company.location_count}</TableCell>
                        <TableCell className="text-right">{company.total_bookings}</TableCell>
                        <TableCell>{formatDateTime(company.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {meta && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {meta.page} of {totalPages} &middot; {meta.total} total
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
