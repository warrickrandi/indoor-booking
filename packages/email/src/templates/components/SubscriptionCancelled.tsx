import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { buttonStyle, EmailLayout } from './EmailLayout.js'

export interface SubscriptionCancelledProps {
  planName:     string
  accessUntil:  string
  dashboardUrl: string
  primaryColor: string
  logoUrl?:     string
  platformName: string
}

export function SubscriptionCancelled(props: SubscriptionCancelledProps) {
  const { planName, accessUntil, dashboardUrl, primaryColor, logoUrl, platformName } = props

  return (
    <EmailLayout previewText="Your subscription cancellation is scheduled" platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>Cancellation scheduled</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Your subscription has been scheduled for cancellation. You'll keep your <strong>{planName}</strong> plan and
        features until <strong>{accessUntil}</strong>, after which your account will move to the Basic plan.
      </Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Changed your mind? You can resubscribe at any time before then from your dashboard.
      </Text>
      <Button href={dashboardUrl} style={buttonStyle(primaryColor)}>
        Go to dashboard
      </Button>
    </EmailLayout>
  )
}
