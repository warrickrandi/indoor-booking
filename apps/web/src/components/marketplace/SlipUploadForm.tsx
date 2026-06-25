'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { mpPost, mpUploadFile } from '@/lib/marketplace-api'
import { showApiErrorToast } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SlipUploadFormProps {
  bookingId: string
  onSuccess?: () => void
}

export function SlipUploadForm({ bookingId, onSuccess }: SlipUploadFormProps) {
  const [bankName, setBankName] = useState('')
  const [transferRef, setTransferRef] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const uploadSlip = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Select a file')
      const formData = new FormData()
      formData.set('booking_id', bookingId)
      formData.set('file', file)
      const uploaded = await mpUploadFile<{ url: string }>('/uploads/slip', formData, { requireAuth: true })
      return mpPost(
        `/bookings/${bookingId}/slip`,
        { slip_image_url: uploaded.data.url, bank_name: bankName, transfer_ref: transferRef },
        { requireAuth: true },
      )
    },
    onSuccess: () => {
      toast.success('Payment slip uploaded')
      setBankName('')
      setTransferRef('')
      setFile(null)
      onSuccess?.()
    },
    onError: showApiErrorToast,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Payment Slip</CardTitle>
        <CardDescription>Submit your bank transfer details so the venue can verify payment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Bank Name</Label>
          <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Transfer Reference</Label>
          <Input value={transferRef} onChange={(e) => setTransferRef(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Slip Image</Label>
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button
          className="w-full"
          disabled={!file || !bankName || !transferRef || uploadSlip.isPending}
          onClick={() => uploadSlip.mutate()}
        >
          {uploadSlip.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Upload Slip
        </Button>
      </CardContent>
    </Card>
  )
}
