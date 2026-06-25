import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { buttonStyle, DetailsTable, EmailLayout } from './EmailLayout.js'

export interface PaymentPendingProps {
  customerName:  string
  bookingRef:    string
  venueName:     string
  subVenueName:  string
  date:          string
  time:          string
  amount:        string
  currency:      string
  bankName?:     string
  accountName?:  string
  accountNumber?: string
  branchCode?:   string
  uploadUrl:     string
  primaryColor:  string
  logoUrl?:      string
  platformName:  string
}

export function PaymentPending(props: PaymentPendingProps) {
  const { customerName, bookingRef, venueName, subVenueName, date, time, amount, currency, bankName, accountName, accountNumber, branchCode, uploadUrl, primaryColor, logoUrl, platformName } = props

  const hasBankDetails = Boolean(bankName && accountNumber)

  return (
    <EmailLayout previewText={`Action needed: complete payment for booking ${bookingRef}`} platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>Payment pending</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Hi {customerName}, your booking at {venueName} is reserved but awaiting payment confirmation via bank transfer.
      </Text>
      <DetailsTable
        rows={[
          { label: 'Booking reference', value: bookingRef },
          { label: 'Venue', value: venueName },
          { label: 'Court / facility', value: subVenueName },
          { label: 'Date', value: date },
          { label: 'Time', value: time },
          { label: 'Amount due', value: `${currency} ${amount}` },
        ]}
      />
      {hasBankDetails ? (
        <>
          <Text style={{ fontSize: '14px', fontWeight: 'bold', color: '#18181b' }}>Bank transfer details</Text>
          <DetailsTable
            rows={[
              { label: 'Bank', value: bankName ?? '' },
              { label: 'Account name', value: accountName ?? '' },
              { label: 'Account number', value: accountNumber ?? '' },
              ...(branchCode ? [{ label: 'Branch', value: branchCode }] : []),
            ]}
          />
        </>
      ) : (
        <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
          Please contact the venue for bank transfer details.
        </Text>
      )}
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        After transferring, upload your payment slip so the venue can confirm your booking.
      </Text>
      <Button href={uploadUrl} style={buttonStyle(primaryColor)}>
        Upload payment slip
      </Button>
    </EmailLayout>
  )
}
