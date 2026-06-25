import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { buttonStyle, EmailLayout } from './EmailLayout.js'

export interface PasswordResetProps {
  customerName:   string
  resetUrl:       string
  expiryMinutes:  number
  primaryColor:   string
  logoUrl?:       string
  platformName:   string
}

export function PasswordReset(props: PasswordResetProps) {
  const { customerName, resetUrl, expiryMinutes, primaryColor, logoUrl, platformName } = props

  return (
    <EmailLayout previewText={`Reset your ${platformName} password`} platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>Reset your password</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Hi {customerName}, we received a request to reset your {platformName} password. Click the button below
        to choose a new password. This link expires in {expiryMinutes} minutes.
      </Text>
      <Button href={resetUrl} style={buttonStyle(primaryColor)}>
        Reset password
      </Button>
      <Text style={{ fontSize: '12px', color: '#a1a1aa' }}>
        If you didn't request this, you can safely ignore this email — your password will not be changed.
      </Text>
    </EmailLayout>
  )
}
