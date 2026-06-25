import { Text } from '@react-email/components'
import * as React from 'react'
import { DetailsTable, EmailLayout } from './EmailLayout.js'

export interface BookingReminderProps {
  customerName: string
  bookingRef:   string
  venueName:    string
  subVenueName: string
  date:         string
  time:         string
  venueAddress: string
  primaryColor: string
  logoUrl?:     string
  platformName: string
}

export function BookingReminder(props: BookingReminderProps) {
  const { customerName, bookingRef, venueName, subVenueName, date, time, venueAddress, primaryColor, logoUrl, platformName } = props

  return (
    <EmailLayout previewText={`Reminder: your booking at ${venueName} is tomorrow`} platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>Upcoming booking reminder</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Hi {customerName}, this is a reminder that you have a booking at {venueName} tomorrow.
      </Text>
      <DetailsTable
        rows={[
          { label: 'Booking reference', value: bookingRef },
          { label: 'Venue', value: venueName },
          { label: 'Court / facility', value: subVenueName },
          { label: 'Date', value: date },
          { label: 'Time', value: time },
          { label: 'Address', value: venueAddress },
        ]}
      />
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        See you there!
      </Text>
    </EmailLayout>
  )
}
