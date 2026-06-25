import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { buttonStyle, EmailLayout } from './EmailLayout.js'

export interface WelcomeOwnerProps {
  customerName: string
  companyName:  string
  dashboardUrl: string
  primaryColor: string
  logoUrl?:     string
  platformName: string
}

export function WelcomeOwner(props: WelcomeOwnerProps) {
  const { customerName, companyName, dashboardUrl, primaryColor, logoUrl, platformName } = props

  return (
    <EmailLayout previewText={`Welcome to ${platformName}`} platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>Welcome, {customerName}!</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Your venue account for <strong>{companyName}</strong> has been created on {platformName}. From your
        dashboard you can set up locations, courts, pricing and start taking bookings.
      </Text>
      <Button href={dashboardUrl} style={buttonStyle(primaryColor)}>
        Go to dashboard
      </Button>
    </EmailLayout>
  )
}
