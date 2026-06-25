import type { SubVenue, PricingRule, Prisma } from '@sports-booking/db'
import type {
  CreateSubVenueBody,
  UpdateSubVenueBody,
  CreatePricingRuleBody,
  UpdatePricingRuleBody,
} from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { ConflictError, NotFoundError } from '../lib/errors.js'

function serializeSubVenue(subVenue: SubVenue) {
  return {
    id:            subVenue.id,
    location_id:   subVenue.location_id,
    name:          subVenue.name,
    sport_type:    subVenue.sport_type,
    description:   subVenue.description,
    capacity:      subVenue.capacity,
    amenities:     subVenue.amenities,
    status:        subVenue.status,
    display_order: subVenue.display_order,
  }
}

function serializePricingRule(rule: PricingRule) {
  return {
    id:                 rule.id,
    rule_name:          rule.name,
    rate_type:          rule.rate_type,
    price_per_slot:     Number(rule.price_per_slot),
    slot_duration_mins: rule.duration_mins,
    peak_start:         rule.peak_start,
    peak_end:           rule.peak_end,
    applicable_days:    rule.applicable_days,
    valid_from:         rule.valid_from ? rule.valid_from.toISOString().slice(0, 10) : null,
    valid_until:        rule.valid_until ? rule.valid_until.toISOString().slice(0, 10) : null,
    is_active:          rule.is_active,
    created_at:         rule.created_at,
  }
}

async function getOwnedLocation(locationId: string, companyId: string) {
  const location = await prisma.location.findFirst({
    where: { id: locationId, company_id: companyId },
  })
  if (!location) {
    throw new NotFoundError('Location')
  }
  return location
}

async function getOwnedSubVenue(subVenueId: string, locationId: string, companyId: string) {
  const subVenue = await prisma.subVenue.findFirst({
    where: { id: subVenueId, location_id: locationId, company_id: companyId },
  })
  if (!subVenue) {
    throw new NotFoundError('Sub-venue')
  }
  return subVenue
}

async function getOwnedPricingRule(ruleId: string, subVenueId: string) {
  const rule = await prisma.pricingRule.findFirst({
    where: { id: ruleId, sub_venue_id: subVenueId },
  })
  if (!rule) {
    throw new NotFoundError('Pricing rule')
  }
  return rule
}

export async function listSubVenues(locationId: string, companyId: string) {
  await getOwnedLocation(locationId, companyId)

  const subVenues = await prisma.subVenue.findMany({
    where:   { location_id: locationId, status: 'active' },
    include: { _count: { select: { pricing_rules: true } } },
    orderBy: { display_order: 'asc' },
  })

  return subVenues.map((subVenue) => ({
    ...serializeSubVenue(subVenue),
    pricing_rules_count: subVenue._count.pricing_rules,
  }))
}

export async function createSubVenue(locationId: string, companyId: string, data: CreateSubVenueBody) {
  await getOwnedLocation(locationId, companyId)

  const subVenue = await prisma.subVenue.create({
    data: {
      location_id:   locationId,
      company_id:    companyId,
      name:          data.name,
      sport_type:    data.sport_type,
      description:   data.description,
      capacity:      data.capacity,
      display_order: data.display_order ?? 0,
      amenities:     data.amenities ?? [],
    },
  })

  return serializeSubVenue(subVenue)
}

export async function getSubVenue(subVenueId: string, locationId: string, companyId: string) {
  const subVenue = await prisma.subVenue.findFirst({
    where:   { id: subVenueId, location_id: locationId, company_id: companyId },
    include: { pricing_rules: { orderBy: { created_at: 'asc' } } },
  })

  if (!subVenue) {
    throw new NotFoundError('Sub-venue')
  }

  return {
    ...serializeSubVenue(subVenue),
    pricing_rules: subVenue.pricing_rules.map(serializePricingRule),
  }
}

export async function updateSubVenue(
  subVenueId: string,
  locationId: string,
  companyId: string,
  data: UpdateSubVenueBody,
) {
  await getOwnedSubVenue(subVenueId, locationId, companyId)

  const updated = await prisma.subVenue.update({
    where: { id: subVenueId },
    data:  {
      name:          data.name,
      sport_type:    data.sport_type,
      description:   data.description,
      capacity:      data.capacity,
      status:        data.status,
      display_order: data.display_order,
      amenities:     data.amenities,
    },
  })

  return serializeSubVenue(updated)
}

export async function deleteSubVenue(subVenueId: string, locationId: string, companyId: string) {
  await getOwnedSubVenue(subVenueId, locationId, companyId)

  const futureBooking = await prisma.booking.findFirst({
    where: {
      status:    { not: 'cancelled' },
      time_slot: { sub_venue_id: subVenueId, start_time: { gt: new Date() } },
    },
  })

  if (futureBooking) {
    throw new ConflictError('Cannot delete a sub-venue with upcoming bookings')
  }

  await prisma.subVenue.update({ where: { id: subVenueId }, data: { status: 'inactive' } })

  return { message: 'Sub-venue deactivated' }
}

export async function listPricingRules(subVenueId: string, locationId: string, companyId: string) {
  await getOwnedSubVenue(subVenueId, locationId, companyId)

  const rules = await prisma.pricingRule.findMany({
    where:   { sub_venue_id: subVenueId },
    orderBy: { created_at: 'asc' },
  })

  return rules.map(serializePricingRule)
}

export async function createPricingRule(
  subVenueId: string,
  locationId: string,
  companyId: string,
  data: CreatePricingRuleBody,
) {
  await getOwnedSubVenue(subVenueId, locationId, companyId)

  const rule = await prisma.pricingRule.create({
    data: {
      sub_venue_id:    subVenueId,
      company_id:      companyId,
      name:            data.rule_name,
      rate_type:       data.rate_type,
      price_per_slot:  data.price_per_slot,
      duration_mins:   data.slot_duration_mins,
      peak_start:      data.peak_start,
      peak_end:        data.peak_end,
      applicable_days: data.applicable_days as Prisma.InputJsonValue,
      valid_from:      data.valid_from ? new Date(data.valid_from) : undefined,
      valid_until:     data.valid_until ? new Date(data.valid_until) : undefined,
    },
  })

  return serializePricingRule(rule)
}

export async function updatePricingRule(
  ruleId: string,
  subVenueId: string,
  locationId: string,
  companyId: string,
  data: UpdatePricingRuleBody,
) {
  await getOwnedSubVenue(subVenueId, locationId, companyId)
  await getOwnedPricingRule(ruleId, subVenueId)

  const updated = await prisma.pricingRule.update({
    where: { id: ruleId },
    data:  {
      name:            data.rule_name,
      rate_type:       data.rate_type,
      price_per_slot:  data.price_per_slot,
      duration_mins:   data.slot_duration_mins,
      peak_start:      data.peak_start,
      peak_end:        data.peak_end,
      applicable_days: data.applicable_days as Prisma.InputJsonValue | undefined,
      valid_from:      data.valid_from ? new Date(data.valid_from) : undefined,
      valid_until:     data.valid_until ? new Date(data.valid_until) : undefined,
    },
  })

  return serializePricingRule(updated)
}

export async function deletePricingRule(
  ruleId: string,
  subVenueId: string,
  locationId: string,
  companyId: string,
) {
  await getOwnedSubVenue(subVenueId, locationId, companyId)
  await getOwnedPricingRule(ruleId, subVenueId)

  await prisma.pricingRule.update({ where: { id: ruleId }, data: { is_active: false } })

  return { message: 'Pricing rule deactivated' }
}
