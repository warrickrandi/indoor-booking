import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { buttonStyle, DetailsTable, EmailLayout } from './EmailLayout.js'

export interface SubscriptionConfirmedProps {
  planName:        string
  billingCycle:    string
  nextRenewalDate: string
  dashboardUrl:    string
  primaryColor:    string
  logoUrl?:        string
  platformName:    string
}

export function SubscriptionConfirmed(props: SubscriptionConfirmedProps) {
  const { planName, billingCycle, nextRenewalDate, dashboardUrl, primaryColor, logoUrl, platformName } = props

  return (
    <EmailLayout previewText={`Payment received — you're now on the ${planName} plan`} platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>Payment received</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Thanks! Your payment has been received and your account is now on the <strong>{planName}</strong> plan.
      </Text>
      <DetailsTable
        rows={[
          { label: 'Plan', value: planName },
          { label: 'Billing cycle', value: billingCycle },
          { label: 'Next renewal', value: nextRenewalDate },
        ]}
      />
      <Button href={dashboardUrl} style={buttonStyle(primaryColor)}>
        Go to dashboard
      </Button>
    </EmailLayout>
  )
}
