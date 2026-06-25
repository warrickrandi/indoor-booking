'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { CreditCard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/store/auth.store'
import {
  useAvailableGateways,
  useGatewayConfigBySlug,
  useUpdateGatewayConfig,
  type GatewaySummary,
} from '@/hooks/usePayments'
import { GATEWAY_CREDENTIAL_FIELDS } from '@/lib/gateway-fields'
import { showApiErrorToast } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

export default function GatewayPage() {
  const actor = useAuthStore((state) => state.actor)
  const gateways = useAvailableGateways()
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)

  const canConfigure = actor?.permissions.includes('payments.gateway_config') ?? false

  useEffect(() => {
    if (selectedSlug || !gateways.data) return
    const active = gateways.data.find((g) => g.is_venue_config_active)
    const fallback = gateways.data.find((g) => g.is_active)
    setSelectedSlug(active?.slug ?? fallback?.slug ?? null)
  }, [gateways.data, selectedSlug])

  if (!canConfigure) {
    return (
      <EmptyState
        title="Access restricted"
        description="You don't have permission to manage payment gateway settings."
      />
    )
  }

  return (
    <div>
      <PageHeader title="Payment Gateway" description="Choose and configure how your venue accepts online payments" />

      {gateways.isLoading ? (
        <LoadingPanel />
      ) : !gateways.data?.length ? (
        <EmptyState
          title="No payment gateways available"
          description="Contact platform support to enable a payment gateway."
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gateway</CardTitle>
              <CardDescription>Select which payment provider your venue uses at checkout</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedSlug ?? ''} onValueChange={setSelectedSlug}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Select a gateway" />
                </SelectTrigger>
                <SelectContent>
                  {gateways.data.map((gateway) => (
                    <SelectItem key={gateway.slug} value={gateway.slug} disabled={!gateway.is_active}>
                      <span className="flex items-center gap-2">
                        {gateway.name}
                        {gateway.is_stub && <Badge variant="secondary">Beta</Badge>}
                        {!gateway.is_active && <Badge variant="outline">Coming soon</Badge>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedSlug && (
            <GatewayConfigCard slug={selectedSlug} gateway={gateways.data.find((g) => g.slug === selectedSlug)} />
          )}
        </div>
      )}
    </div>
  )
}

function GatewayConfigCard({ slug, gateway }: { slug: string; gateway: GatewaySummary | undefined }) {
  const configQuery = useGatewayConfigBySlug(slug)
  const updateGateway = useUpdateGatewayConfig(slug)
  const [editing, setEditing] = useState(false)

  const fields = GATEWAY_CREDENTIAL_FIELDS[slug] ?? []

  const form = useForm<Record<string, string>>({
    defaultValues: Object.fromEntries(fields.map((f) => [f.key, ''])),
  })

  useEffect(() => {
    setEditing(false)
    form.reset(Object.fromEntries(fields.map((f) => [f.key, ''])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  if (fields.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Integration in progress"
        description={`${gateway?.name ?? 'This gateway'} isn't configurable yet. Check back soon.`}
      />
    )
  }

  if (configQuery.isLoading) {
    return <LoadingPanel />
  }

  const data = configQuery.data
  const showForm = editing || !data?.configured

  const onSubmit = (values: Record<string, string>) => {
    const missing = fields.filter((f) => f.required && !values[f.key]?.trim())
    if (missing.length > 0) {
      toast.error(`${missing.map((f) => f.label).join(', ')} ${missing.length > 1 ? 'are' : 'is'} required`)
      return
    }

    const credentials: Record<string, string> = {}
    for (const field of fields) {
      const value = values[field.key]?.trim()
      if (value) credentials[field.key] = value
    }

    updateGateway.mutate(credentials, {
      onSuccess: () => {
        toast.success('Payment gateway configuration saved')
        setEditing(false)
        form.reset(Object.fromEntries(fields.map((f) => [f.key, ''])))
      },
      onError: showApiErrorToast,
    })
  }

  if (!showForm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {gateway?.name ?? slug} Configuration
            <Badge variant={data?.is_active ? 'success' : 'secondary'}>{data?.is_active ? 'Active' : 'Inactive'}</Badge>
          </CardTitle>
          {data?.updated_at && <CardDescription>Last updated {formatDateTime(data.updated_at)}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(data?.credentials ?? {}).map(([key, value]) => (
            <div key={key}>
              <p className="text-sm text-muted-foreground">{fieldLabel(slug, key)}</p>
              <p className="font-mono">{value}</p>
            </div>
          ))}
          <Button variant="outline" onClick={() => setEditing(true)}>
            Update Credentials
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{data?.configured ? `Update ${gateway?.name ?? ''} Credentials` : `Configure ${gateway?.name ?? ''}`}</CardTitle>
        <CardDescription>
          {data?.configured
            ? 'Enter new credentials to replace the existing configuration. Credentials are encrypted before storage.'
            : slug === 'payhere'
              ? 'Without a venue-specific configuration, the platform master credentials are used for online payments.'
              : 'Credentials are encrypted before storage.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!data?.configured && slug === 'payhere' && (
          <EmptyState
            icon={CreditCard}
            title="No venue-specific gateway configured"
            description="Add your PayHere merchant credentials below to accept payments directly to your account."
            className="mb-6 border-none p-0"
          />
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <FormField
                  key={field.key}
                  control={form.control}
                  name={field.key}
                  render={({ field: formField }) => (
                    <FormItem>
                      <FormLabel>{field.label}</FormLabel>
                      <FormControl>
                        <Input type={field.type} {...formField} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {data?.configured && (
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={updateGateway.isPending}>
                {updateGateway.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Credentials
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function fieldLabel(slug: string, key: string): string {
  const field = GATEWAY_CREDENTIAL_FIELDS[slug]?.find((f) => f.key === key)
  if (field) return field.label.replace(' (optional)', '')

  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
