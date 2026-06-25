import nodemailer from 'nodemailer'
import type { EmailTemplate } from '@sports-booking/db'
import { renderEmailTemplate, type TemplateKey } from '@sports-booking/email'
import type { EmailJobData } from '@sports-booking/types'
import { decrypt } from '../lib/encrypt.js'
import { env } from '../lib/env.js'
import { prisma } from '../lib/prisma.js'

interface ResolvedEmailConfig {
  host:     string
  port:     number
  secure:   boolean
  user?:    string
  pass?:    string
  from:     string
  fromName?: string
  replyTo?: string
  dkim?: {
    domainName: string
    keySelector: string
    privateKey: string
  }
}

function resolveDkim(config: {
  dkim_selector: string | null
  dkim_private_key_encrypted: string | null
  from_address: string | null
}): ResolvedEmailConfig['dkim'] {
  if (!config.dkim_selector || !config.dkim_private_key_encrypted || !config.from_address?.includes('@')) {
    return undefined
  }

  return {
    domainName: config.from_address.split('@')[1] as string,
    keySelector: config.dkim_selector,
    privateKey: decrypt(config.dkim_private_key_encrypted),
  }
}

function platformSmtpConfig(): ResolvedEmailConfig {
  return {
    host:   env.SMTP_HOST,
    port:   env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    user:   env.SMTP_USER,
    pass:   env.SMTP_PASSWORD,
    from:   env.SMTP_FROM,
  }
}

export async function resolveEmailConfig(companyId: string | null): Promise<ResolvedEmailConfig> {
  if (!companyId) {
    return platformSmtpConfig()
  }

  const config = await prisma.companyEmailConfig.findUnique({ where: { company_id: companyId } })

  if (!config || config.mode === 'platform') {
    return platformSmtpConfig()
  }

  if (config.mode === 'subdomain') {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } })
    return {
      ...platformSmtpConfig(),
      from: `noreply@${company?.slug ?? 'venue'}.yourplatform.com`,
    }
  }

  if (config.mode === 'custom_domain') {
    return {
      ...platformSmtpConfig(),
      from:     config.from_address ?? env.SMTP_FROM,
      fromName: config.from_name ?? undefined,
      replyTo:  config.reply_to ?? undefined,
      dkim:     resolveDkim(config),
    }
  }

  // mode === 'custom_smtp'
  return {
    host:     config.smtp_host ?? env.SMTP_HOST,
    port:     config.smtp_port ?? 587,
    secure:   config.smtp_encryption === 'ssl',
    user:     config.smtp_user ?? undefined,
    pass:     config.smtp_password_encrypted ? decrypt(config.smtp_password_encrypted) : undefined,
    from:     config.from_address ?? env.SMTP_FROM,
    fromName: config.from_name ?? undefined,
    replyTo:  config.reply_to ?? undefined,
    dkim:     resolveDkim(config),
  }
}

export async function resolveTemplate(companyId: string | null, templateKey: string): Promise<EmailTemplate | null> {
  if (companyId) {
    const override = await prisma.emailTemplate.findFirst({
      where: { company_id: companyId, template_key: templateKey, is_active: true },
    })
    if (override) {
      return override
    }
  }

  return prisma.emailTemplate.findFirst({
    where: { company_id: null, template_key: templateKey, is_active: true },
  })
}

function substituteVars(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const value = data[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

export interface RenderedEmail {
  subject: string
  html:    string
  text:    string
}

export async function renderEmail(
  templateKey: TemplateKey,
  data: Record<string, unknown>,
  dbTemplate: EmailTemplate | null,
): Promise<RenderedEmail> {
  if (dbTemplate) {
    const subject = substituteVars(dbTemplate.subject, data)
    const html = substituteVars(dbTemplate.html_body, data)
    const text = dbTemplate.text_body ? substituteVars(dbTemplate.text_body, data) : stripHtml(html)
    return { subject, html, text }
  }

  return renderEmailTemplate(templateKey, data)
}

export async function sendEmail({ to, template, data, companyId, bookingId }: EmailJobData): Promise<void> {
  const templateKey = template as TemplateKey
  const resolvedCompanyId = companyId ?? null

  const config = await resolveEmailConfig(resolvedCompanyId)
  const dbTemplate = await resolveTemplate(resolvedCompanyId, templateKey)
  const rendered = await renderEmail(templateKey, data, dbTemplate)

  const transporter = nodemailer.createTransport({
    host:   config.host,
    port:   config.port,
    secure: config.secure,
    auth:   config.user ? { user: config.user, pass: config.pass } : undefined,
    dkim:   config.dkim,
  })

  const from = config.fromName ? `"${config.fromName}" <${config.from}>` : config.from

  try {
    const info = await transporter.sendMail({
      from,
      to,
      replyTo: config.replyTo,
      subject: rendered.subject,
      html:    rendered.html,
      text:    rendered.text,
    })

    await prisma.emailLog.create({
      data: {
        company_id:   resolvedCompanyId,
        booking_id:   bookingId ?? null,
        template_key: templateKey,
        to_address:   to,
        subject:      rendered.subject,
        status:       'sent',
        message_id:   info.messageId,
        sent_at:      new Date(),
      },
    })
  } catch (err) {
    await prisma.emailLog.create({
      data: {
        company_id:    resolvedCompanyId,
        booking_id:    bookingId ?? null,
        template_key:  templateKey,
        to_address:    to,
        subject:       rendered.subject,
        status:        'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error',
      },
    })

    throw err
  }
}
