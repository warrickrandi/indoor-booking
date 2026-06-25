import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { buttonStyle, EmailLayout } from './EmailLayout.js'

export interface DomainLiveProps {
  domain:       string
  dashboardUrl: string
  primaryColor: string
  logoUrl?:     string
  platformName: string
}

export function DomainLive(props: DomainLiveProps) {
  const { domain, dashboardUrl, primaryColor, logoUrl, platformName } = props

  return (
    <EmailLayout previewText={`Your custom domain ${domain} is now live`} platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>Your custom domain is live</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        <strong>{domain}</strong> is now verified and SSL-secured. Your marketplace is live on this domain.
      </Text>
      <Button href={dashboardUrl} style={buttonStyle(primaryColor)}>
        Go to dashboard
      </Button>
    </EmailLayout>
  )
}
