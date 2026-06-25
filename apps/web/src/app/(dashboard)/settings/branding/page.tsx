'use client'

import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UpdateBrandingBodySchema, type UpdateBrandingBody } from '@sports-booking/types'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/store/auth.store'
import { useCompany, type CompanyDetail } from '@/hooks/useCompany'
import { put, showApiErrorToast } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

interface BrandingFormValues {
  primary_color: string
  secondary_color: string
  logo_url: string
  favicon_url: string
  meta_title: string
  meta_description: string
}

export default function BrandingPage() {
  const actor = useAuthStore((state) => state.actor)
  const company = useCompany()

  const canEdit = actor?.permissions.includes('company.branding') ?? false

  if (!canEdit) {
    return (
      <EmptyState
        title="Access restricted"
        description="You don't have permission to manage branding settings."
      />
    )
  }

  return (
    <div>
      <PageHeader title="Branding" description="Customize how your venue appears on the marketplace" />

      {company.isLoading ? (
        <LoadingPanel />
      ) : !company.data ? (
        <EmptyState title="Failed to load company details" description="Please try again." />
      ) : (
        <BrandingForm company={company.data} />
      )}
    </div>
  )
}

function BrandingForm({ company }: { company: CompanyDetail }) {
  const queryClient = useQueryClient()
  const branding = company.branding

  const form = useForm<BrandingFormValues>({
    defaultValues: {
      primary_color: branding?.primary_color ?? '#2563eb',
      secondary_color: branding?.secondary_color ?? '#1e293b',
      logo_url: branding?.logo_url ?? '',
      favicon_url: branding?.favicon_url ?? '',
      meta_title: branding?.meta_title ?? '',
      meta_description: branding?.meta_description ?? '',
    },
  })

  const primaryColor = form.watch('primary_color')
  const secondaryColor = form.watch('secondary_color')
  const metaTitle = form.watch('meta_title')

  const updateBranding = useMutation({
    mutationFn: (body: UpdateBrandingBody) => put('/company/me/branding', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] })
      toast.success('Branding updated')
    },
    onError: showApiErrorToast,
  })

  const onSubmit = (values: BrandingFormValues) => {
    const body: UpdateBrandingBody = {
      primary_color: values.primary_color || undefined,
      secondary_color: values.secondary_color || undefined,
      meta_title: values.meta_title || undefined,
      meta_description: values.meta_description || undefined,
      logo_url: values.logo_url || undefined,
      favicon_url: values.favicon_url || undefined,
    }

    const parsed = UpdateBrandingBodySchema.safeParse(body)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    updateBranding.mutate(parsed.data)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Brand Settings</CardTitle>
          <CardDescription>Applied to your marketplace storefront</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="primary_color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" className="h-10 w-14 p-1" {...field} />
                          <Input {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="secondary_color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" className="h-10 w-14 p-1" {...field} />
                          <Input {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="logo_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="favicon_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Favicon URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="meta_title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meta Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="meta_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meta Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={updateBranding.isPending}>
                {updateBranding.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
          <CardDescription>An approximation of your marketplace header</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between p-4 text-white" style={{ backgroundColor: primaryColor }}>
              <span className="font-semibold">{company.name}</span>
              <span className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: secondaryColor }}>
                Book Now
              </span>
            </div>
            <div className="space-y-1 p-4">
              <p className="text-sm font-medium">{metaTitle || company.name}</p>
              <p className="text-sm text-muted-foreground">Marketplace storefront preview</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
