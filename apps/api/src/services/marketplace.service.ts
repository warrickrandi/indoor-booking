import bcrypt from 'bcryptjs'
import type { CustomerRegisterBody, CustomerLoginBody, MarketplaceVenuesQuery } from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { signPlayerToken, signPlayerRefreshToken } from '../lib/jwt.js'
import { addEmailJob } from '../jobs/email.job.js'
import { env } from '../lib/env.js'
import { ConflictError, NotFoundError, UnauthorizedError } from '../lib/errors.js'

const BCRYPT_ROUNDS = 12
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60

function refreshKey(customerId: string): string {
  return `player_refresh:${customerId}`
}

function serializeCustomer(customer: {
  id: string
  full_name: string
  email: string | null
  phone: string | null
}) {
  return { id: customer.id, full_name: customer.full_name, email: customer.email, phone: customer.phone }
}

export async function registerCustomer(input: CustomerRegisterBody) {
  const existing = await prisma.customer.findFirst({
    where: { email: input.email, company_id: null },
  })
  if (existing) {
    throw new ConflictError('Email already registered')
  }

  const password_hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)

  const customer = await prisma.customer.create({
    data: {
      company_id: null,
      full_name:  input.full_name,
      email:      input.email,
      phone:      input.phone,
      password_hash,
      status:     'active',
    },
  })

  const access_token = signPlayerToken({ sub: customer.id, email: input.email })
  const refresh_token = signPlayerRefreshToken(customer.id)
  await redis.set(refreshKey(customer.id), refresh_token, 'EX', REFRESH_TTL_SECONDS)

  await addEmailJob(input.email, 'welcome_player', {
    customerName: customer.full_name,
    browseUrl:    `${env.FRONTEND_URL}/venues`,
  }, { companyId: customer.company_id })

  return { access_token, refresh_token, customer: serializeCustomer(customer) }
}

export async function loginCustomer(input: CustomerLoginBody) {
  const customer = await prisma.customer.findFirst({
    where: { email: input.email, company_id: null },
  })

  if (!customer || !customer.password_hash) {
    throw new UnauthorizedError('Invalid email or password')
  }

  const valid = await bcrypt.compare(input.password, customer.password_hash)
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password')
  }

  const access_token = signPlayerToken({ sub: customer.id, email: input.email })
  const refresh_token = signPlayerRefreshToken(customer.id)
  await redis.set(refreshKey(customer.id), refresh_token, 'EX', REFRESH_TTL_SECONDS)

  return { access_token, refresh_token, customer: serializeCustomer(customer) }
}

export async function listVenues(query: MarketplaceVenuesQuery) {
  const { sport_type, city, page, limit } = query

  const where = {
    status: 'active' as const,
    locations: {
      some: {
        status: 'active' as const,
        ...(city ? { city } : {}),
        sub_venues: {
          some: {
            status: 'active' as const,
            ...(sport_type ? { sport_type } : {}),
          },
        },
      },
    },
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: {
        branding: true,
        locations: {
          where: { status: 'active' },
          include: { sub_venues: { where: { status: 'active' } } },
        },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.company.count({ where }),
  ])

  const data = companies.map((company) => {
    const cities = [...new Set(company.locations.map((location) => location.city).filter((city): city is string => !!city))]
    const sport_types = [
      ...new Set(company.locations.flatMap((location) => location.sub_venues.map((subVenue) => subVenue.sport_type))),
    ]

    return {
      slug:          company.slug,
      name:          company.name,
      tagline:       company.branding?.tagline ?? null,
      primary_color: company.branding?.primary_color ?? '#3B82F6',
      logo_url:      company.branding?.logo_url ?? null,
      cities,
      sport_types,
    }
  })

  return { data, meta: { page, limit, total } }
}

export async function resolveDomainByHost(host: string) {
  const row = await prisma.companyDomain.findFirst({
    where:   { domain: host, is_verified: true, is_active: true },
    include: { company: { select: { slug: true, status: true } } },
  })

  if (!row || row.company.status !== 'active') {
    throw new NotFoundError('Domain')
  }

  return { slug: row.company.slug }
}

export async function getVenueBySlug(slug: string) {
  const company = await prisma.company.findFirst({
    where: { slug, status: 'active' },
    include: {
      branding: true,
      locations: {
        where: { status: 'active' },
        orderBy: { display_order: 'asc' },
        include: {
          sub_venues: { where: { status: 'active' }, orderBy: { display_order: 'asc' } },
          operating_hours: true,
        },
      },
    },
  })

  if (!company) {
    throw new NotFoundError('Venue')
  }

  return {
    id:   company.id,
    name: company.name,
    slug: company.slug,
    tagline: company.branding?.tagline ?? null,
    branding: {
      primary_color:    company.branding?.primary_color ?? '#3B82F6',
      secondary_color:  company.branding?.secondary_color ?? '#1E40AF',
      logo_url:         company.branding?.logo_url ?? null,
      favicon_url:      company.branding?.favicon_url ?? null,
      meta_title:       company.branding?.meta_title ?? null,
      meta_description: company.branding?.meta_description ?? null,
    },
    locations: company.locations.map((location) => ({
      id:       location.id,
      name:     location.name,
      address:  location.address,
      city:     location.city,
      phone:    location.phone,
      timezone: location.timezone,
      operating_hours: location.operating_hours.map((hour) => ({
        day_of_week: hour.day_of_week,
        open_time:   hour.open_time,
        close_time:  hour.close_time,
        is_closed:   hour.is_closed,
      })),
      sub_venues: location.sub_venues.map((subVenue) => ({
        id:            subVenue.id,
        name:          subVenue.name,
        sport_type:    subVenue.sport_type,
        description:   subVenue.description,
        capacity:      subVenue.capacity,
        amenities:     subVenue.amenities,
        display_order: subVenue.display_order,
      })),
    })),
  }
}
