'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  EMAIL_CONFIG_MODES,
  UpdateEmailConfigBodySchema,
  TestEmailConfigBodySchema,
  type EmailConfigMode,
  type UpdateEmailConfigBody,
} from '@sports-booking/types'
import { Copy, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/store/auth.store'
import { useEmailConfig, useUpdateEmailConfig, useVerifyEmailConfig, useTestEmailConfig, type EmailConfigResponse } from '@/hooks/useEmailConfig'
import { showApiErrorToast } from '@/lib/api'
import { cn, formatDateTime, TIER_RANK } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

const MODE_MIN_TIER: Record<EmailConfigMode, 'basic' | 'pro' | 'elite'> = {
  platform: 'basic',
  subdomain: 'pro',
  custom_domain: 'elite',
  custom_smtp: 'elite',
}

const MODE_LABELS: Record<EmailConfigMode, string> = {
  platform: 'Platform (default)',
  subdomain: 'Branded Subdomain',
  custom_domain: 'Custom Domain',
  custom_smtp: 'Own SMTP Server',
}

interface EmailConfigFormValues {
  mode: EmailConfigMode
  from_name: string
  from_address: string
  reply_to: string
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_pass: string
  smtp_encryption: 'tls' | 'ssl' | 'none'
  dkim_selector: string
}

export default function EmailSettingsPage() {
  const actor = useAuthStore((state) => state.actor)
  const emailConfig = useEmailConfig()

  const canEdit = actor?.permissions.includes('company.branding') ?? false

  if (!canEdit) {
    return (
      <EmptyState title="Access restricted" description="You don't have permission to manage email settings." />
    )
  }

  return (
    <div>
      <PageHeader title="Email" description="Control how booking emails are sent to your customers" />

      {emailConfig.isLoading ? (
        <LoadingPanel />
      ) : !emailConfig.data ? (
        <EmptyState title="Failed to load email configuration" description="Please try again." />
      ) : (
        <EmailConfigForm config={emailConfig.data} actorTier={actor!.tier} />
      )}
    </div>
  )
}

function EmailConfigForm({ config, actorTier }: { config: EmailConfigResponse; actorTier: 'basic' | 'pro' | 'elite' }) {
  const company = useAuthStore((state) => state.company)
  const updateConfig = useUpdateEmailConfig()
  const verifyDns = useVerifyEmailConfig()

  const form = useForm<EmailConfigFormValues>({
    defaultValues: {
      mode: (config.mode as EmailConfigMode) ?? 'platform',
      from_name: config.from_name ?? '',
      from_address: config.from_address ?? '',
      reply_to: config.reply_to ?? '',
      smtp_host: config.smtp_host ?? '',
      smtp_port: config.smtp_port ? String(config.smtp_port) : '',
      smtp_user: config.smtp_user ?? '',
      smtp_pass: '',
      smtp_encryption: (config.smtp_encryption as 'tls' | 'ssl' | 'none') ?? 'tls',
      dkim_selector: config.dkim_selector ?? '',
    },
  })

  const mode = form.watch('mode')
  const fromAddress = form.watch('from_address')
  const dkimSelector = form.watch('dkim_selector')

  const onSubmit = (values: EmailConfigFormValues) => {
    const body: UpdateEmailConfigBody = {
      mode: values.mode,
      from_name: values.from_name || undefined,
      from_address: values.from_address || undefined,
      reply_to: values.reply_to || undefined,
      smtp_host: values.smtp_host || undefined,
      smtp_port: values.smtp_port ? Number(values.smtp_port) : undefined,
      smtp_user: values.smtp_user || undefined,
      smtp_pass: values.smtp_pass || undefined,
      smtp_encryption: values.smtp_encryption,
      dkim_selector: values.dkim_selector || undefined,
    }

    const parsed = UpdateEmailConfigBodySchema.safeParse(body)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }

    updateConfig.mutate(parsed.data, {
      onSuccess: () => {
        toast.success('Email settings saved')
        form.reset({ ...values, smtp_pass: '' })
      },
      onError: showApiErrorToast,
    })
  }

  const domain = fromAddress.includes('@') ? fromAddress.split('@')[1] : null
  const showDnsCard = (mode === 'custom_domain' || mode === 'custom_smtp') && !!domain

  const dnsRecords = domain
    ? [
        {
          label: 'SPF',
          host: domain,
          value: 'v=spf1 include:spf.yourplatform.com ~all',
          verified: config.spf_verified,
        },
        {
          label: 'DKIM',
          host: `${dkimSelector || 'postal'}._domainkey.${domain}`,
          value: 'Generated in your mail server domain settings — copy the key value shown there',
          verified: config.dkim_verified,
        },
        {
          label: 'DMARC',
          host: `_dmarc.${domain}`,
          value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`,
          verified: config.dmarc_verified,
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sending Mode</CardTitle>
          <CardDescription>
            {config.updated_at ? `Last updated ${formatDateTime(config.updated_at)}` : 'Choose how outgoing booking emails are sent'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mode</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EMAIL_CONFIG_MODES.map((m) => {
                          const disabled = TIER_RANK[actorTier] < TIER_RANK[MODE_MIN_TIER[m]]
                          return (
                            <SelectItem key={m} value={m} disabled={disabled}>
                              {MODE_LABELS[m]}
                              {disabled ? ` (Requires ${MODE_MIN_TIER[m] === 'pro' ? 'Pro' : 'Elite'}+)` : ''}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      {mode === 'platform' && 'Emails are sent from noreply@yourplatform.com using our shared mail servers. No setup required.'}
                      {mode === 'subdomain' &&
                        `Emails are sent from noreply@${company?.slug ?? 'your-venue'}.yourplatform.com, branded with your venue name.`}
                      {mode === 'custom_domain' &&
                        'Emails are sent from your own domain via our mail servers. Requires adding the DNS records below.'}
                      {mode === 'custom_smtp' && 'Emails are sent through your own SMTP server. You control delivery and branding end-to-end.'}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(mode === 'custom_domain' || mode === 'custom_smtp') && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="from_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Venue Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="from_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Address</FormLabel>
                        <FormControl>
                          <Input placeholder="bookings@yourvenue.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reply_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reply-To (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="support@yourvenue.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {mode === 'custom_domain' && (
                    <FormField
                      control={form.control}
                      name="dkim_selector"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>DKIM Selector (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="postal" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}

              {mode === 'custom_smtp' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="smtp_host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Host</FormLabel>
                        <FormControl>
                          <Input placeholder="smtp.yourprovider.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="smtp_port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Port</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="587" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="smtp_user"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Username</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="smtp_pass"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder={config.smtp_password ? config.smtp_password : 'Enter password'} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="smtp_encryption"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Encryption</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="tls">TLS (STARTTLS)</SelectItem>
                            <SelectItem value="ssl">SSL</SelectItem>
                            <SelectItem value="none">None</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <Button type="submit" disabled={updateConfig.isPending}>
                {updateConfig.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {showDnsCard && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              DNS Records
              <Button variant="outline" size="sm" onClick={() => verifyDns.mutate(undefined, { onError: showApiErrorToast })} disabled={verifyDns.isPending}>
                {verifyDns.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify DNS
              </Button>
            </CardTitle>
            <CardDescription>Add these TXT records to your domain&apos;s DNS to authenticate outgoing email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dnsRecords.map((record) => (
              <DnsRecordRow key={record.label} {...record} />
            ))}
          </CardContent>
        </Card>
      )}

      <TestEmailCard />
    </div>
  )
}

function DnsRecordRow({ label, host, value, verified }: { label: string; host: string; value: string; verified: boolean }) {
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <Badge variant={verified ? 'success' : 'warning'}>{verified ? 'Verified' : 'Not verified'}</Badge>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-muted-foreground">Host</span>
          <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">{host}</code>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(host)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-muted-foreground">Value</span>
          <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">{value}</code>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(value)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function TestEmailCard() {
  const [toAddress, setToAddress] = useState('')
  const sendTest = useTestEmailConfig()

  const handleSendTest = () => {
    const parsed = TestEmailConfigBodySchema.safeParse({ to_address: toAddress })
    if (!parsed.success) {
      toast.error('Enter a valid email address')
      return
    }

    sendTest.mutate(parsed.data, {
      onSuccess: () => toast.success('Test email queued'),
      onError: showApiErrorToast,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Test Email</CardTitle>
        <CardDescription>Send a sample email using your current settings to confirm everything is wired up correctly</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={cn('flex flex-col gap-2 sm:flex-row')}>
          <Input
            type="email"
            placeholder="you@example.com"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            className="sm:max-w-sm"
          />
          <Button type="button" onClick={handleSendTest} disabled={sendTest.isPending}>
            {sendTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Test Email
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
