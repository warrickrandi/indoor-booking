'use client'

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'

import { usePlatformAdminAuthStore } from '@/store/platform-admin-auth.store'
import { useAdminGatewayDrivers, useUpdateGatewayDriver } from '@/hooks/useAdmin'
import { formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

export default function AdminGatewayDriversPage() {
  const admin = usePlatformAdminAuthStore((state) => state.admin)
  const drivers = useAdminGatewayDrivers()
  const updateDriver = useUpdateGatewayDriver()

  const [names, setNames] = useState<Record<string, string>>({})

  const canEdit = admin?.platform_role === 'super_admin'

  return (
    <div>
      <PageHeader title="Gateway Drivers" description="Payment gateway drivers available to venues" />

      <Card>
        <CardContent className="pt-6">
          {drivers.isLoading ? (
            <LoadingPanel />
          ) : drivers.isError || !drivers.data ? (
            <EmptyState title="Failed to load gateway drivers" description="Please try again." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slug</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Created</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.data.map((driver) => {
                    const editedName = names[driver.id] ?? driver.name
                    const nameChanged = editedName !== driver.name && editedName.trim().length > 0

                    return (
                      <TableRow key={driver.id}>
                        <TableCell className="font-mono text-sm">{driver.slug}</TableCell>
                        <TableCell>
                          {canEdit ? (
                            <Input
                              value={editedName}
                              onChange={(e) => setNames((prev) => ({ ...prev, [driver.id]: e.target.value }))}
                              className="max-w-[200px]"
                            />
                          ) : (
                            driver.name
                          )}
                        </TableCell>
                        <TableCell>
                          {canEdit ? (
                            <Switch
                              checked={driver.is_active}
                              disabled={updateDriver.isPending}
                              onCheckedChange={(checked) =>
                                updateDriver.mutate({ driverId: driver.id, body: { is_active: checked } })
                              }
                            />
                          ) : (
                            <Badge variant={driver.is_active ? 'success' : 'secondary'}>
                              {driver.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDateTime(driver.created_at)}</TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!nameChanged || updateDriver.isPending}
                              onClick={() =>
                                updateDriver.mutate({
                                  driverId: driver.id,
                                  body: { display_name: editedName.trim() },
                                })
                              }
                            >
                              {updateDriver.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                              Save
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
