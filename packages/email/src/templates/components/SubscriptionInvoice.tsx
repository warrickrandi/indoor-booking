import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { buttonStyle, DetailsTable, EmailLayout } from './EmailLayout.js'

export interface SubscriptionInvoiceProps {
  companyName:  string
  planName:     string
  amount:       string
  dueDate:      string
  invoiceUrl:   string
  primaryColor: string
  logoUrl?:     string
  platformName: string
}

export function SubscriptionInvoice(props: SubscriptionInvoiceProps) {
  const { companyName, planName, amount, dueDate, invoiceUrl, primaryColor, logoUrl, platformName } = props

  return (
    <EmailLayout previewText={`New invoice for ${companyName} — ${planName} plan`} platformName={platformName} primaryColor={primaryColor} logoUrl={logoUrl}>
      <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>New subscription invoice</Text>
      <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
        A new invoice has been generated for <strong>{companyName}</strong> on the <strong>{planName}</strong> plan.
      </Text>
      <DetailsTable
        rows={[
          { label: 'Plan', value: planName },
          { label: 'Amount due', value: amount },
          { label: 'Due date', value: dueDate },
        ]}
      />
      <Button href={invoiceUrl} style={buttonStyle(primaryColor)}>
        View invoice
      </Button>
    </EmailLayout>
  )
}
