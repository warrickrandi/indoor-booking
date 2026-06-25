import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { buttonStyle, EmailLayout } from './EmailLayout.js'

export interface TrialExpiringProps {
  planName:     string
  trialEndsAt:  string
  upgradeUrl:   string
  primaryColor: string
  logoUrl?:     string
  platformName: string
}

export function TrialExpiring(props: TrialExpiringProps) {
  const { planName, trialEndsAt, upgradeUrl, primaryColor, logoUrl, platformName } = props

  return (
    <EmailLayout previewText={`Your ${planName} trial ends ${trialEndsAt}`} platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>Your trial is ending soon</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Your <strong>{planName}</strong> trial ends on <strong>{trialEndsAt}</strong>. Add a payment method and
        upgrade to keep access to your {planName} features.
      </Text>
      <Button href={upgradeUrl} style={buttonStyle(primaryColor)}>
        Upgrade now
      </Button>
    </EmailLayout>
  )
}
