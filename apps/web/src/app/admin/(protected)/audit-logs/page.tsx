'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { useAdminAuditLogs, type AuditLogEntry } from '@/hooks/useAdmin'
import { formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

const PAGE_LIMIT = 20

export default function AdminAuditLogsPage() {
  const [companyId, setCompanyId] = useState('')
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)

  const auditLogs = useAdminAuditLogs({
    company_id: companyId || undefined,
    user_id: userId || undefined,
    action: action || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
    page,
    limit: PAGE_LIMIT,
  })

  const rows = auditLogs.data?.data ?? []
  const meta = auditLogs.data?.meta
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1

  const handleFilterChange = () => setPage(1)

  return (
    <div>
      <PageHeader title="Audit Logs" description="Administrative and financial changes across the platform" />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label>Company ID</Label>
            <Input
              placeholder="UUID"
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value)
                handleFilterChange()
              }}
            />
          </div>
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label>User ID</Label>
            <Input
              placeholder="UUID"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value)
                handleFilterChange()
              }}
            />
          </div>
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label>Action</Label>
            <Input
              placeholder="e.g. booking.cancelled"
              value={action}
              onChange={(e) => {
                setAction(e.target.value)
                handleFilterChange()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>From Date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                handleFilterChange()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                handleFilterChange()
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {auditLogs.isLoading ? (
            <LoadingPanel />
          ) : auditLogs.isError ? (
            <EmptyState title="Failed to load audit logs" description="Please try again." />
          ) : rows.length === 0 ? (
            <EmptyState title="No audit log entries" description="Try adjusting your filters." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((log) => (
                      <TableRow key={log.id} className="cursor-pointer" onClick={() => setSelectedLog(log)}>
                        <TableCell>{formatDateTime(log.created_at)}</TableCell>
                        <TableCell>
                          <div>{log.actor?.full_name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{log.actor_type}</div>
                        </TableCell>
                        <TableCell>{log.company?.name ?? '—'}</TableCell>
                        <TableCell className="font-medium">{log.action}</TableCell>
                        <TableCell>
                          {log.entity_type ?? '—'}
                          {log.entity_id && (
                            <div className="text-xs text-muted-foreground">{log.entity_id}</div>
                          )}
                        </TableCell>
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

      <Dialog open={selectedLog !== null} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedLog?.action}</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">Before</p>
                <pre className="max-h-80 overflow-auto rounded-md border bg-muted p-3 text-xs">
                  {JSON.stringify(selectedLog.changes?.before ?? null, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">After</p>
                <pre className="max-h-80 overflow-auto rounded-md border bg-muted p-3 text-xs">
                  {JSON.stringify(selectedLog.changes?.after ?? null, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
