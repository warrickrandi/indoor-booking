import { Text } from '@react-email/components'
import * as React from 'react'
import { DetailsTable, EmailLayout } from './EmailLayout.js'

export interface SlipApprovedProps {
  customerName:  string
  bookingRef:    string
  venueName:     string
  subVenueName:  string
  date:          string
  time:          string
  duration:      string
  amount:        string
  currency:      string
  paymentMethod: string
  venueAddress:  string
  primaryColor:  string
  logoUrl?:      string
  platformName:  string
}

export function SlipApproved(props: SlipApprovedProps) {
  const { customerName, bookingRef, venueName, subVenueName, date, time, duration, amount, currency, paymentMethod, venueAddress, primaryColor, logoUrl, platformName } = props

  return (
    <EmailLayout previewText={`Payment confirmed for booking ${bookingRef}`} platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>Payment confirmed!</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Hi {customerName}, your payment slip was approved and your booking at {venueName} is confirmed. Here are your details:
      </Text>
      <DetailsTable
        rows={[
          { label: 'Booking reference', value: bookingRef },
          { label: 'Venue', value: venueName },
          { label: 'Court / facility', value: subVenueName },
          { label: 'Date', value: date },
          { label: 'Time', value: time },
          { label: 'Duration', value: duration },
          { label: 'Amount', value: `${currency} ${amount}` },
          { label: 'Payment method', value: paymentMethod },
          { label: 'Address', value: venueAddress },
        ]}
      />
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Please arrive a few minutes early. See you on the court!
      </Text>
    </EmailLayout>
  )
}
