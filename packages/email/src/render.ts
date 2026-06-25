import { render } from '@react-email/render'
import * as React from 'react'
import { DEFAULT_PRIMARY_COLOR, PLATFORM_NAME } from './templates/constants.js'
import type { TemplateKey } from './templates/index.js'
import { TEMPLATE_REGISTRY } from './templates/registry.js'

export interface RenderedEmail {
  subject: string
  html:    string
  text:    string
}

export async function renderEmailTemplate(key: TemplateKey, data: Record<string, unknown>): Promise<RenderedEmail> {
  const entry = TEMPLATE_REGISTRY[key]
  const props = { platformName: PLATFORM_NAME, primaryColor: DEFAULT_PRIMARY_COLOR, ...data }

  const element = React.createElement(entry.Component, props)

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ])

  return {
    subject: entry.subject(props),
    html,
    text,
  }
}
