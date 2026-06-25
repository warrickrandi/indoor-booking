import { Text } from '@react-email/components'
import * as React from 'react'
import { DetailsTable, EmailLayout } from './EmailLayout.js'

export interface BookingCancelledProps {
  customerName: string
  bookingRef:   string
  venueName:    string
  subVenueName: string
  date:         string
  time:         string
  reason?:      string
  primaryColor: string
  logoUrl?:     string
  platformName: string
}

export function BookingCancelled(props: BookingCancelledProps) {
  const { customerName, bookingRef, venueName, subVenueName, date, time, reason, primaryColor, logoUrl, platformName } = props

  return (
    <EmailLayout previewText={`Your booking ${bookingRef} has been cancelled`} platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>Booking cancelled</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Hi {customerName}, your booking at {venueName} has been cancelled.
      </Text>
      <DetailsTable
        rows={[
          { label: 'Booking reference', value: bookingRef },
          { label: 'Venue', value: venueName },
          { label: 'Court / facility', value: subVenueName },
          { label: 'Date', value: date },
          { label: 'Time', value: time },
          ...(reason ? [{ label: 'Reason', value: reason }] : []),
        ]}
      />
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        If you have any questions about this cancellation, please contact the venue directly.
      </Text>
    </EmailLayout>
  )
}
