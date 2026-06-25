import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { buttonStyle, EmailLayout } from './EmailLayout.js'

export interface StaffInviteProps {
  companyName:    string
  roleName:       string
  setPasswordUrl?: string
  primaryColor:   string
  logoUrl?:       string
  platformName:   string
}

export function StaffInvite(props: StaffInviteProps) {
  const { companyName, roleName, setPasswordUrl, primaryColor, logoUrl, platformName } = props

  return (
    <EmailLayout previewText={`You've been invited to join ${companyName} on ${platformName}`} platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>You're invited to {companyName}</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        You've been added as <strong>{roleName}</strong> for <strong>{companyName}</strong> on {platformName}.
        {setPasswordUrl ? ' Set your password to get started.' : ' You can now sign in with your existing account.'}
      </Text>
      {setPasswordUrl ? (
        <Button href={setPasswordUrl} style={buttonStyle(primaryColor)}>
          Set your password
        </Button>
      ) : null}
    </EmailLayout>
  )
}
