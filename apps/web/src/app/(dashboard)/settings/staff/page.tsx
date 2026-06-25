'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  InviteMemberBodySchema,
  type InviteMemberBody,
  UpdateMemberBodySchema,
  type UpdateMemberBody,
} from '@sports-booking/types'
import { Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/store/auth.store'
import { useMembers, type CompanyMember } from '@/hooks/useCompany'
import { useLocations, type LocationSummary } from '@/hooks/useLocations'
import { post, put, del, showApiErrorToast } from '@/lib/api'
import { TIER_RANK } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

const ROLE_LABELS: Record<string, string> = {
  location_manager: 'Location Manager',
  receptionist: 'Receptionist',
}

const ROLE_OPTIONS = ['location_manager', 'receptionist'] as const

export default function StaffPage() {
  const actor = useAuthStore((state) => state.actor)
  const members = useMembers()
  const locations = useLocations()
  const queryClient = useQueryClient()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [editMember, setEditMember] = useState<CompanyMember | null>(null)

  const inviteForm = useForm<InviteMemberBody>({
    resolver: zodResolver(InviteMemberBodySchema),
    defaultValues: { email: '', role_key: 'receptionist', location_ids: [] },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['members'] })

  const inviteMember = useMutation({
    mutationFn: (values: InviteMemberBody) => post('/company/me/members/invite', values),
    onSuccess: () => {
      invalidate()
      toast.success('Member invited')
      setInviteOpen(false)
      inviteForm.reset({ email: '', role_key: 'receptionist', location_ids: [] })
    },
    onError: showApiErrorToast,
  })

  const removeMember = useMutation({
    mutationFn: (memberId: string) => del(`/company/me/members/${memberId}`),
    onSuccess: () => {
      invalidate()
      toast.success('Member removed')
    },
    onError: showApiErrorToast,
  })

  const canInvite = actor?.permissions.includes('staff.invite') ?? false

  if (!canInvite) {
    return <EmptyState title="Access restricted" description="You don't have permission to manage staff." />
  }

  const inviteRoleOptions =
    actor && TIER_RANK[actor.tier] >= TIER_RANK.pro ? ROLE_OPTIONS : (['receptionist'] as const)

  const locationName = (id: string) => locations.data?.find((l) => l.id === id)?.name ?? id

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Manage staff accounts and their location access"
        action={
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Staff Member</DialogTitle>
                <DialogDescription>They&apos;ll receive an email invitation to join your team.</DialogDescription>
              </DialogHeader>
              <Form {...inviteForm}>
                <form
                  onSubmit={inviteForm.handleSubmit((values) => inviteMember.mutate(values))}
                  className="space-y-4"
                >
                  <FormField
                    control={inviteForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={inviteForm.control}
                    name="role_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {inviteRoleOptions.map((role) => (
                              <SelectItem key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={inviteForm.control}
                    name="location_ids"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location Access</FormLabel>
                        <div className="space-y-2 rounded-md border p-3">
                          {(locations.data ?? []).map((location) => {
                            const checked = field.value?.includes(location.id) ?? false
                            return (
                              <div key={location.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`invite-loc-${location.id}`}
                                  checked={checked}
                                  onCheckedChange={(value) => {
                                    const current = field.value ?? []
                                    field.onChange(
                                      value === true
                                        ? [...current, location.id]
                                        : current.filter((id) => id !== location.id),
                                    )
                                  }}
                                />
                                <Label htmlFor={`invite-loc-${location.id}`} className="font-normal">
                                  {location.name}
                                </Label>
                              </div>
                            )
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Leave unchecked to grant access to all locations.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={inviteMember.isPending}>
                      {inviteMember.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Send Invite
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {members.isLoading ? (
            <LoadingPanel />
          ) : !members.data || members.data.length === 0 ? (
            <EmptyState title="No staff members yet" description="Invite your first team member to get started." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Locations</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.data.map((member) => {
                    const isOwner = member.role.role_key === 'owner'
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.user.full_name}</TableCell>
                        <TableCell>{member.user.email}</TableCell>
                        <TableCell>{member.role.display_name}</TableCell>
                        <TableCell>
                          {member.location_ids.length === 0
                            ? 'All locations'
                            : member.location_ids.map(locationName).join(', ')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.status === 'active' ? 'success' : 'secondary'}>
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!isOwner && (
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => setEditMember(member)}>
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={removeMember.isPending}
                                onClick={() => {
                                  if (window.confirm(`Remove ${member.user.full_name} from your team?`)) {
                                    removeMember.mutate(member.id)
                                  }
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editMember && (
        <EditMemberDialog
          member={editMember}
          locations={locations.data ?? []}
          onClose={() => setEditMember(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  )
}

interface EditMemberDialogProps {
  member: CompanyMember
  locations: LocationSummary[]
  onClose: () => void
  onSaved: () => void
}

function EditMemberDialog({ member, locations, onClose, onSaved }: EditMemberDialogProps) {
  const form = useForm<UpdateMemberBody>({
    resolver: zodResolver(UpdateMemberBodySchema),
    defaultValues: {
      role_key: member.role.role_key === 'location_manager' ? 'location_manager' : 'receptionist',
      location_ids: member.location_ids,
    },
  })

  const updateMember = useMutation({
    mutationFn: (values: UpdateMemberBody) => put(`/company/me/members/${member.id}`, values),
    onSuccess: () => {
      onSaved()
      toast.success('Member updated')
      onClose()
    },
    onError: showApiErrorToast,
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {member.user.full_name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => updateMember.mutate(values))} className="space-y-4">
            <FormField
              control={form.control}
              name="role_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Access</FormLabel>
                  <div className="space-y-2 rounded-md border p-3">
                    {locations.map((location) => {
                      const checked = field.value?.includes(location.id) ?? false
                      return (
                        <div key={location.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`edit-loc-${location.id}`}
                            checked={checked}
                            onCheckedChange={(value) => {
                              const current = field.value ?? []
                              field.onChange(
                                value === true
                                  ? [...current, location.id]
                                  : current.filter((id) => id !== location.id),
                              )
                            }}
                          />
                          <Label htmlFor={`edit-loc-${location.id}`} className="font-normal">
                            {location.name}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">Leave unchecked to grant access to all locations.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={updateMember.isPending}>
                {updateMember.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
