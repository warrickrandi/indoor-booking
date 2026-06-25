'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/store/auth.store'
import { useBooking } from '@/hooks/useBookings'
import { post, uploadFile, showApiErrorToast } from '@/lib/api'
import { formatCurrency, formatDate, formatDateTime, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { BookingTimeline } from '@/components/shared/BookingTimeline'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  online: 'Online',
  bank_transfer: 'Bank Transfer',
  pay_at_venue: 'Pay at Venue',
}

interface InitiatePaymentResult {
  checkout_url: string
  checkout_params: Record<string, string>
}

export default function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const actor = useAuthStore((state) => state.actor)
  const queryClient = useQueryClient()

  const booking = useBooking(bookingId)

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [slipBankName, setSlipBankName] = useState('')
  const [slipTransferRef, setSlipTransferRef] = useState('')
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [checkout, setCheckout] = useState<InitiatePaymentResult | null>(null)
  const checkoutFormRef = useRef<HTMLFormElement>(null)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['bookings', bookingId] })
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
  }

  const cancelBooking = useMutation({
    mutationFn: () => post(`/bookings/${bookingId}/cancel`, {}),
    onSuccess: () => {
      invalidate()
      toast.success('Booking cancelled')
    },
    onError: showApiErrorToast,
  })

  const checkIn = useMutation({
    mutationFn: () => post(`/bookings/${bookingId}/check-in`),
    onSuccess: () => {
      invalidate()
      toast.success('Booking checked in')
    },
    onError: showApiErrorToast,
  })

  const markPaid = useMutation({
    mutationFn: () => post(`/bookings/${bookingId}/mark-paid`),
    onSuccess: () => {
      invalidate()
      toast.success('Booking marked as paid')
    },
    onError: showApiErrorToast,
  })

  const verifySlip = useMutation({
    mutationFn: (decision: { approved: boolean; rejection_reason?: string }) =>
      post(`/bookings/${bookingId}/slip/verify`, decision),
    onSuccess: (_res, variables) => {
      invalidate()
      toast.success(variables.approved ? 'Slip approved' : 'Slip rejected')
      setRejectOpen(false)
      setRejectionReason('')
    },
    onError: showApiErrorToast,
  })

  const uploadSlip = useMutation({
    mutationFn: async () => {
      if (!slipFile) throw new Error('Select a file')
      const formData = new FormData()
      formData.set('booking_id', bookingId)
      formData.set('file', slipFile)
      const uploaded = await uploadFile<{ url: string }>('/uploads/slip', formData)
      return post(`/bookings/${bookingId}/slip`, {
        slip_image_url: uploaded.data.url,
        bank_name: slipBankName,
        transfer_ref: slipTransferRef,
      })
    },
    onSuccess: () => {
      invalidate()
      toast.success('Payment slip uploaded')
      setSlipBankName('')
      setSlipTransferRef('')
      setSlipFile(null)
    },
    onError: showApiErrorToast,
  })

  const initiatePayment = useMutation({
    mutationFn: () => post<InitiatePaymentResult>('/payments/initiate', { booking_id: bookingId }),
    onSuccess: (res) => {
      setCheckout(res.data)
    },
    onError: showApiErrorToast,
  })

  useEffect(() => {
    if (checkout && checkoutFormRef.current) {
      checkoutFormRef.current.submit()
    }
  }, [checkout])

  if (booking.isLoading) {
    return <LoadingPanel />
  }

  if (!booking.data) {
    return <EmptyState title="Booking not found" description="This booking may have been removed." />
  }

  const data = booking.data
  const canCheckin = actor?.permissions.includes('bookings.checkin') ?? false
  const canVerifySlip = actor?.permissions.includes('payments.verify_slip') ?? false
  const canCancel = actor?.permissions.includes('bookings.cancel') ?? false

  const transaction = data.payment_transactions[0]
  const pendingVerification = transaction?.bank_verifications.find((v) => v.status === 'pending')
  const showUploadSlip =
    data.status === 'pending_verification' && data.payment_method === 'bank_transfer' && !pendingVerification

  const hasActions =
    (data.status === 'pending_payment' && data.payment_method === 'online') ||
    (data.status === 'confirmed' && data.payment_method === 'pay_at_venue' && canCheckin) ||
    (data.status === 'confirmed' && canCheckin) ||
    (data.status === 'pending_verification' && !!pendingVerification && canVerifySlip) ||
    (['pending_payment', 'pending_verification', 'confirmed'].includes(data.status) && canCancel)

  return (
    <div>
      <PageHeader
        title={`Booking ${data.booking_ref}`}
        description={`${data.time_slot.sub_venue_name} · ${data.time_slot.location_name}`}
        action={<StatusBadge status={data.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Booking Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium">{data.customer.full_name}</p>
                <p className="text-sm text-muted-foreground">{data.customer.email}</p>
                <p className="text-sm text-muted-foreground">{data.customer.phone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sub-Venue</p>
                <p className="font-medium">{data.time_slot.sub_venue_name}</p>
                <p className="text-sm text-muted-foreground">
                  {data.time_slot.location_name} &middot; {data.time_slot.sport_type}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date &amp; Time</p>
                <p className="font-medium">{formatDate(data.time_slot.start_time)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatTime(data.time_slot.start_time)} - {formatTime(data.time_slot.end_time)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment</p>
                <p className="font-medium">{PAYMENT_METHOD_LABELS[data.payment_method] ?? data.payment_method}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(data.total_amount, data.currency)}</p>
              </div>
              {data.notes && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{data.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {data.payment_transactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payment Transactions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.payment_transactions.map((tx) => (
                  <div key={tx.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{formatCurrency(tx.amount, tx.currency)}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.gateway_slug}
                          {tx.gateway_order_id && ` · ${tx.gateway_order_id}`}
                        </p>
                      </div>
                      <StatusBadge status={tx.status} />
                    </div>
                    {tx.paid_at && (
                      <p className="mt-1 text-xs text-muted-foreground">Paid {formatDateTime(tx.paid_at)}</p>
                    )}
                    {tx.bank_verifications.map((v) => (
                      <div key={v.id} className="mt-2 rounded-md bg-muted p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate font-medium">
                            {v.bank_name} &middot; {v.transfer_ref}
                          </p>
                          <StatusBadge status={v.status} className="shrink-0" />
                        </div>
                        <a
                          href={v.slip_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          View slip image
                        </a>
                        {v.rejection_reason && (
                          <p className="mt-1 text-muted-foreground">Reason: {v.rejection_reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {showUploadSlip && (
            <Card>
              <CardHeader>
                <CardTitle>Upload Payment Slip</CardTitle>
                <CardDescription>Submit bank transfer details for staff verification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Bank Name</Label>
                  <Input value={slipBankName} onChange={(e) => setSlipBankName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Transfer Reference</Label>
                  <Input value={slipTransferRef} onChange={(e) => setSlipTransferRef(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Slip Image</Label>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <Button
                  disabled={!slipFile || !slipBankName || !slipTransferRef || uploadSlip.isPending}
                  onClick={() => uploadSlip.mutate()}
                >
                  {uploadSlip.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Upload Slip
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Status History</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingTimeline entries={data.status_log} />
            </CardContent>
          </Card>
        </div>

        {hasActions && (
          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.status === 'pending_payment' && data.payment_method === 'online' && (
                  <Button
                    className="w-full"
                    disabled={initiatePayment.isPending}
                    onClick={() => initiatePayment.mutate()}
                  >
                    {initiatePayment.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Pay Now
                  </Button>
                )}
                {data.status === 'confirmed' && data.payment_method === 'pay_at_venue' && canCheckin && (
                  <Button
                    className="w-full"
                    variant="secondary"
                    disabled={markPaid.isPending}
                    onClick={() => markPaid.mutate()}
                  >
                    {markPaid.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Mark as Paid
                  </Button>
                )}
                {data.status === 'confirmed' && canCheckin && (
                  <Button
                    className="w-full"
                    variant="secondary"
                    disabled={checkIn.isPending}
                    onClick={() => checkIn.mutate()}
                  >
                    {checkIn.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Check In
                  </Button>
                )}
                {data.status === 'pending_verification' && pendingVerification && canVerifySlip && (
                  <>
                    <Button
                      className="w-full"
                      disabled={verifySlip.isPending}
                      onClick={() => verifySlip.mutate({ approved: true })}
                    >
                      {verifySlip.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Approve Slip
                    </Button>
                    <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full" variant="destructive">
                          Reject Slip
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Reject Payment Slip</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-1.5">
                          <Label>Rejection Reason</Label>
                          <Textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                          />
                        </div>
                        <DialogFooter>
                          <Button
                            variant="destructive"
                            disabled={!rejectionReason || verifySlip.isPending}
                            onClick={() =>
                              verifySlip.mutate({ approved: false, rejection_reason: rejectionReason })
                            }
                          >
                            {verifySlip.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            Confirm Rejection
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
                {['pending_payment', 'pending_verification', 'confirmed'].includes(data.status) && canCancel && (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={cancelBooking.isPending}
                    onClick={() => {
                      if (window.confirm('Cancel this booking?')) {
                        cancelBooking.mutate()
                      }
                    }}
                  >
                    {cancelBooking.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Cancel Booking
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {checkout && (
        <form ref={checkoutFormRef} method="POST" action={checkout.checkout_url} className="hidden">
          {Object.entries(checkout.checkout_params).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        </form>
      )}
    </div>
  )
}
