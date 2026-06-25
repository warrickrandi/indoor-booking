'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AddDomainBodySchema, type AddDomainBody } from '@sports-booking/types'
import { Copy, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/store/auth.store'
import {
  useDomainSettings,
  useAddDomain,
  useVerifyDomain,
  useRemoveDomain,
  type AddDomainResponse,
  type CompanyDomain,
  type DomainSettingsResponse,
} from '@/hooks/useDomains'
import { showApiErrorToast } from '@/lib/api'
import { TIER_RANK } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? ''

export default function DomainsPage() {
  const actor = useAuthStore((state) => state.actor)
  const company = useAuthStore((state) => state.company)
  const domains = useDomainSettings()

  const canView = actor?.permissions.includes('company.branding') ?? false

  if (!canView) {
    return <EmptyState title="Access restricted" description="You don't have permission to manage domain settings." />
  }

  return (
    <div>
      <PageHeader title="Domains" description="Manage your marketplace URL and custom domains" />

      {domains.isLoading ? (
        <LoadingPanel />
      ) : !domains.data || !company ? (
        <EmptyState title="Failed to load domain settings" description="Please try again." />
      ) : (
        <DomainsContent data={domains.data} actorTier={actor!.tier} slug={company.slug} />
      )}
    </div>
  )
}

function DomainsContent({
  data,
  actorTier,
  slug,
}: {
  data: DomainSettingsResponse
  actorTier: 'basic' | 'pro' | 'elite'
  slug: string
}) {
  const isPro = TIER_RANK[actorTier] >= TIER_RANK.pro
  const isElite = TIER_RANK[actorTier] >= TIER_RANK.elite

  const marketplaceUrl = `https://${isPro ? data.subdomain.value : `${PLATFORM_DOMAIN}/venues/${slug}`}`

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Marketplace URL</CardTitle>
          <CardDescription>
            {isPro ? 'Players can book through your branded subdomain' : 'Players can book through your marketplace listing'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyField value={marketplaceUrl} />
          {!isPro && (
            <EmptyState
              title="Upgrade to Pro"
              description={`Get a branded subdomain like ${slug}.${PLATFORM_DOMAIN} on the Pro plan.`}
            />
          )}
        </CardContent>
      </Card>

      {isPro && !isElite && (
        <EmptyState
          title="Upgrade to Elite"
          description="Bring your own domain (e.g. booking.yourvenue.com) on the Elite plan."
        />
      )}

      {isElite && <CustomDomainsCard domains={data.custom_domains} />}
    </div>
  )
}

function CopyField({ value }: { value: string }) {
  const copy = () => {
    void navigator.clipboard.writeText(value)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded bg-muted px-3 py-2 font-mono text-sm">{value}</code>
      <Button type="button" variant="outline" size="icon" onClick={copy}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  )
}

function StatusBadge({ domain }: { domain: CompanyDomain }) {
  if (!domain.is_verified) {
    return <Badge variant="warning">Pending DNS</Badge>
  }
  if (!domain.ssl_provisioned) {
    return <Badge variant="info">SSL provisioning</Badge>
  }
  return <Badge variant="success">Live</Badge>
}

function CustomDomainsCard({ domains }: { domains: CompanyDomain[] }) {
  const [addOpen, setAddOpen] = useState(false)
  const [newDomain, setNewDomain] = useState<AddDomainResponse | null>(null)
  const addDomain = useAddDomain()
  const verifyDomain = useVerifyDomain()
  const removeDomain = useRemoveDomain()

  const form = useForm<AddDomainBody>({
    resolver: zodResolver(AddDomainBodySchema),
    defaultValues: { domain: '' },
  })

  const onAdd = (values: AddDomainBody) => {
    addDomain.mutate(values, {
      onSuccess: (res) => {
        setNewDomain(res.data)
        form.reset({ domain: '' })
        toast.success('Domain added — add the DNS records below to verify')
      },
      onError: showApiErrorToast,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Custom Domains
          <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open)
              if (!open) setNewDomain(null)
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Domain</DialogTitle>
                <DialogDescription>Connect a domain you own to your marketplace storefront.</DialogDescription>
              </DialogHeader>

              {!newDomain ? (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onAdd)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="domain"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Domain</FormLabel>
                          <FormControl>
                            <Input placeholder="booking.yourvenue.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={addDomain.isPending}>
                        {addDomain.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Add Domain
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Add these DNS records at your domain registrar, then click Verify on the domain list.
                  </p>
                  {newDomain.verification_records.map((record) => (
                    <DnsRecordField key={`${record.type}-${record.name}`} record={record} />
                  ))}
                  <DialogFooter>
                    <Button type="button" onClick={() => setAddOpen(false)}>
                      Done
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </CardTitle>
        <CardDescription>DNS propagation can take up to 48 hours after adding records</CardDescription>
      </CardHeader>
      <CardContent>
        {domains.length === 0 ? (
          <EmptyState title="No custom domains" description="Add a domain you own to use it for your marketplace." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell className="font-medium">{domain.domain}</TableCell>
                    <TableCell>
                      <StatusBadge domain={domain} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!domain.is_verified && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={verifyDomain.isPending}
                            onClick={() =>
                              verifyDomain.mutate(domain.id, {
                                onSuccess: (res) => {
                                  if (res.data.verified) {
                                    toast.success(res.data.message)
                                  } else {
                                    toast(res.data.message)
                                  }
                                },
                                onError: showApiErrorToast,
                              })
                            }
                          >
                            {verifyDomain.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Verify
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={removeDomain.isPending}
                          onClick={() => {
                            if (window.confirm(`Remove ${domain.domain}?`)) {
                              removeDomain.mutate(domain.id, {
                                onSuccess: () => toast.success('Domain removed'),
                                onError: showApiErrorToast,
                              })
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DnsRecordField({ record }: { record: { type: string; name: string; value: string } }) {
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <span className="font-semibold">{record.type} record</span>
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-muted-foreground">Name</span>
        <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">{record.name}</code>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(record.name)}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-muted-foreground">Value</span>
        <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">{record.value}</code>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(record.value)}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
