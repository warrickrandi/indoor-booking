import { Text } from '@react-email/components'
import * as React from 'react'
import { DetailsTable, EmailLayout } from './EmailLayout.js'

export interface SlipRejectedProps {
  customerName:     string
  bookingRef:       string
  rejectionReason:  string
  primaryColor:     string
  logoUrl?:         string
  platformName:     string
}

export function SlipRejected(props: SlipRejectedProps) {
  const { customerName, bookingRef, rejectionReason, primaryColor, logoUrl, platformName } = props

  return (
    <EmailLayout previewText={`Payment slip rejected for booking ${bookingRef}`} platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>Payment slip rejected</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Hi {customerName}, the payment slip you uploaded for booking {bookingRef} could not be verified.
      </Text>
      <DetailsTable
        rows={[
          { label: 'Booking reference', value: bookingRef },
          { label: 'Reason', value: rejectionReason },
        ]}
      />
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Please upload a valid payment slip or contact the venue to resolve this issue. Your slot is not yet confirmed.
      </Text>
    </EmailLayout>
  )
}
