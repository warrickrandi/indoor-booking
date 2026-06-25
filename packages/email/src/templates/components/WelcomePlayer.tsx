import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { buttonStyle, EmailLayout } from './EmailLayout.js'

export interface WelcomePlayerProps {
  customerName: string
  browseUrl:    string
  primaryColor: string
  logoUrl?:     string
  platformName: string
}

export function WelcomePlayer(props: WelcomePlayerProps) {
  const { customerName, browseUrl, primaryColor, logoUrl, platformName } = props

  return (
    <EmailLayout previewText={`Welcome to ${platformName}`} platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>Welcome, {customerName}!</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        Thanks for signing up with {platformName}. You can now browse venues, check availability and book
        futsal, badminton, cricket and playhouse slots near you.
      </Text>
      <Button href={browseUrl} style={buttonStyle(primaryColor)}>
        Browse venues
      </Button>
    </EmailLayout>
  )
}
