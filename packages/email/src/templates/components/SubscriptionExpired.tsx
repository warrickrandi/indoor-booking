import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { buttonStyle, EmailLayout } from './EmailLayout.js'

export interface SubscriptionExpiredProps {
  upgradeUrl:   string
  primaryColor: string
  logoUrl?:     string
  platformName: string
}

export function SubscriptionExpired(props: SubscriptionExpiredProps) {
  const { upgradeUrl, primaryColor, logoUrl, platformName } = props

  return (
    <EmailLayout previewText="Your subscription has expired" platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>Subscription expired</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Your subscription has expired and your account has been downgraded to the Basic plan. Any extra locations
        and your custom domain are now inactive, but nothing has been deleted.
      </Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Upgrade again to restore full access to your locations and features.
      </Text>
      <Button href={upgradeUrl} style={buttonStyle(primaryColor)}>
        Upgrade now
      </Button>
    </EmailLayout>
  )
}
