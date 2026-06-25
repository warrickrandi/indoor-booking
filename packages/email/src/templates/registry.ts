import * as React from 'react'
import type { TemplateKey } from './index.js'
import { BookingCancelled } from './components/BookingCancelled.js'
import { BookingConfirmed } from './components/BookingConfirmed.js'
import { BookingReminder } from './components/BookingReminder.js'
import { DomainLive } from './components/DomainLive.js'
import { PasswordReset } from './components/PasswordReset.js'
import { PaymentPending } from './components/PaymentPending.js'
import { SlipApproved } from './components/SlipApproved.js'
import { SlipRejected } from './components/SlipRejected.js'
import { StaffInvite } from './components/StaffInvite.js'
import { SubscriptionCancelled } from './components/SubscriptionCancelled.js'
import { SubscriptionConfirmed } from './components/SubscriptionConfirmed.js'
import { SubscriptionExpired } from './components/SubscriptionExpired.js'
import { SubscriptionInvoice } from './components/SubscriptionInvoice.js'
import { TrialExpiring } from './components/TrialExpiring.js'
import { WelcomeOwner } from './components/WelcomeOwner.js'
import { WelcomePlayer } from './components/WelcomePlayer.js'

export interface TemplateRegistryEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: React.ComponentType<any>
  subject:   (data: Record<string, unknown>) => string
}

export const TEMPLATE_REGISTRY: Record<TemplateKey, TemplateRegistryEntry> = {
  booking_confirmed: {
    Component: BookingConfirmed,
    subject:   (data) => `Booking confirmed — ${String(data.bookingRef ?? '')}`,
  },
  booking_cancelled: {
    Component: BookingCancelled,
    subject:   (data) => `Booking cancelled — ${String(data.bookingRef ?? '')}`,
  },
  payment_pending: {
    Component: PaymentPending,
    subject:   (data) => `Action needed: complete payment — ${String(data.bookingRef ?? '')}`,
  },
  slip_approved: {
    Component: SlipApproved,
    subject:   (data) => `Payment confirmed — ${String(data.bookingRef ?? '')}`,
  },
  slip_rejected: {
    Component: SlipRejected,
    subject:   (data) => `Payment slip rejected — ${String(data.bookingRef ?? '')}`,
  },
  booking_reminder: {
    Component: BookingReminder,
    subject:   (data) => `Reminder: your booking at ${String(data.venueName ?? 'the venue')} is tomorrow`,
  },
  welcome_player: {
    Component: WelcomePlayer,
    subject:   (data) => `Welcome to ${String(data.platformName ?? 'SportsBooking')}`,
  },
  welcome_owner: {
    Component: WelcomeOwner,
    subject:   (data) => `Welcome to ${String(data.platformName ?? 'SportsBooking')}`,
  },
  password_reset: {
    Component: PasswordReset,
    subject:   (data) => `Reset your ${String(data.platformName ?? 'SportsBooking')} password`,
  },
  staff_invite: {
    Component: StaffInvite,
    subject:   (data) => `You've been invited to join ${String(data.companyName ?? '')}`,
  },
  domain_live: {
    Component: DomainLive,
    subject:   () => 'Your custom domain is now live',
  },
  subscription_invoice: {
    Component: SubscriptionInvoice,
    subject:   (data) => `New invoice — ${String(data.planName ?? '')} plan`,
  },
  subscription_confirmed: {
    Component: SubscriptionConfirmed,
    subject:   (data) => `Payment received — you're on the ${String(data.planName ?? '')} plan`,
  },
  subscription_cancelled: {
    Component: SubscriptionCancelled,
    subject:   () => 'Your subscription cancellation is scheduled',
  },
  subscription_expired: {
    Component: SubscriptionExpired,
    subject:   () => 'Your subscription has expired',
  },
  trial_expiring: {
    Component: TrialExpiring,
    subject:   (data) => `Your ${String(data.planName ?? '')} trial is ending soon`,
  },
}
