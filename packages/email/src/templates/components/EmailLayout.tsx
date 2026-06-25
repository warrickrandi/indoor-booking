import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

export interface DetailRow {
  label: string
  value: string
}

export function DetailsTable({ rows }: { rows: DetailRow[] }) {
  return (
    <Section style={{ backgroundColor: '#f9fafb', borderRadius: '6px', padding: '4px 16px', margin: '16px 0' }}>
      {rows.map((row) => (
        <table key={row.label} width="100%" cellPadding={0} cellSpacing={0} role="presentation">
          <tr>
            <td style={{ padding: '8px 0', color: '#71717a', fontSize: '14px' }}>{row.label}</td>
            <td style={{ padding: '8px 0', color: '#18181b', fontSize: '14px', fontWeight: 'bold', textAlign: 'right' }}>
              {row.value}
            </td>
          </tr>
        </table>
      ))}
    </Section>
  )
}

export function buttonStyle(primaryColor: string): React.CSSProperties {
  return {
    backgroundColor: primaryColor,
    color: '#ffffff',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    textDecoration: 'none',
    textAlign: 'center',
    display: 'inline-block',
    padding: '12px 24px',
  }
}

export interface EmailLayoutProps {
  previewText:  string
  platformName: string
  primaryColor: string
  logoUrl?:     string
  children:     React.ReactNode
}

export function EmailLayout({ previewText, platformName, primaryColor, logoUrl, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: '#f4f4f5', fontFamily: 'Helvetica, Arial, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
          <Section style={{ backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden' }}>
            <Section style={{ backgroundColor: primaryColor, padding: '20px 24px' }}>
              {logoUrl ? (
                <Img src={logoUrl} alt={platformName} height="32" style={{ display: 'block' }} />
              ) : (
                <Text style={{ color: '#ffffff', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                  {platformName}
                </Text>
              )}
            </Section>
            <Section style={{ padding: '24px' }}>
              {children}
            </Section>
            <Section style={{ padding: '16px 24px', borderTop: '1px solid #e4e4e7' }}>
              <Text style={{ color: '#a1a1aa', fontSize: '12px', margin: 0, textAlign: 'center' }}>
                This is an automated message from {platformName}. Please do not reply directly to this email.
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
