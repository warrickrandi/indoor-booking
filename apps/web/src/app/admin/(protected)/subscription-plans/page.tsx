'use client'

import { useState } from 'react'
import type { UpdateSubscriptionPlanBody } from '@sports-booking/types'
import { Loader2, Pencil } from 'lucide-react'

import { usePlatformAdminAuthStore } from '@/store/platform-admin-auth.store'
import { useAdminSubscriptionPlans, useUpdateSubscriptionPlan, type SubscriptionPlan } from '@/hooks/useAdmin'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

const FEATURE_LABELS: Record<string, string> = {
  subdomain: 'Branded Subdomain',
  custom_domain: 'Custom Domain',
  rbac: 'Full RBAC',
  custom_email: 'Custom Email Config',
  reports_full: 'Full Reports / Ledger',
  location_manager_role: 'Location Manager Role',
}

export default function AdminSubscriptionPlansPage() {
  const admin = usePlatformAdminAuthStore((state) => state.admin)
  const plans = useAdminSubscriptionPlans()
  const updatePlan = useUpdateSubscriptionPlan()

  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)

  const canEdit = admin?.platform_role === 'super_admin'

  return (
    <div>
      <PageHeader title="Subscription Plans" description="Manage platform pricing and feature flags" />

      <Card>
        <CardContent className="pt-6">
          {plans.isLoading ? (
            <LoadingPanel />
          ) : plans.isError || !plans.data ? (
            <EmptyState title="Failed to load plans" description="Please try again." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Monthly</TableHead>
                    <TableHead className="text-right">Annual</TableHead>
                    <TableHead className="text-right">Max Locations</TableHead>
                    <TableHead>Features</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.data.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium capitalize">{plan.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(plan.price_monthly)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(plan.price_annual)}</TableCell>
                      <TableCell className="text-right">
                        {plan.max_locations === -1 ? 'Unlimited' : plan.max_locations}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(plan.feature_flags)
                            .filter(([, enabled]) => enabled)
                            .map(([key]) => (
                              <Badge key={key} variant="outline">
                                {FEATURE_LABELS[key] ?? key}
                              </Badge>
                            ))}
                        </div>
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setEditingPlan(plan)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editingPlan && (
        <EditPlanDialog
          plan={editingPlan}
          isPending={updatePlan.isPending}
          onClose={() => setEditingPlan(null)}
          onSave={(body) => updatePlan.mutate({ planId: editingPlan.id, body }, { onSuccess: () => setEditingPlan(null) })}
        />
      )}
    </div>
  )
}

interface EditPlanDialogProps {
  plan: SubscriptionPlan
  isPending: boolean
  onClose: () => void
  onSave: (body: UpdateSubscriptionPlanBody) => void
}

function EditPlanDialog({ plan, isPending, onClose, onSave }: EditPlanDialogProps) {
  const [priceMonthly, setPriceMonthly] = useState(String(plan.price_monthly))
  const [priceAnnual, setPriceAnnual] = useState(String(plan.price_annual))
  const [maxLocations, setMaxLocations] = useState(String(plan.max_locations))
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>(plan.feature_flags)

  const handleSave = () => {
    const body: UpdateSubscriptionPlanBody = {
      price_monthly: Number(priceMonthly),
      price_annual: Number(priceAnnual),
      feature_flags: featureFlags,
    }
    const maxLoc = Number(maxLocations)
    if (maxLoc > 0) {
      body.max_locations = maxLoc
    }
    onSave(body)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="capitalize">Edit {plan.name} Plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Monthly Price (LKR)</Label>
              <Input type="number" min="0" value={priceMonthly} onChange={(e) => setPriceMonthly(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Annual Price (LKR)</Label>
              <Input type="number" min="0" value={priceAnnual} onChange={(e) => setPriceAnnual(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Max Locations</Label>
            <Input type="number" min="-1" value={maxLocations} onChange={(e) => setMaxLocations(e.target.value)} />
            <p className="text-xs text-muted-foreground">Use -1 (unlimited) to leave this unchanged.</p>
          </div>
          <div className="space-y-2">
            <Label>Feature Flags</Label>
            <div className="space-y-2 rounded-md border p-3">
              {Object.entries(featureFlags).map(([key, enabled]) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={`flag-${key}`} className="font-normal">
                    {FEATURE_LABELS[key] ?? key}
                  </Label>
                  <Switch
                    id={`flag-${key}`}
                    checked={enabled}
                    onCheckedChange={(checked) => setFeatureFlags((prev) => ({ ...prev, [key]: checked }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
