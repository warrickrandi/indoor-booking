import { Prisma, type OperatingHour, type LocationHoliday } from '@sports-booking/db'
import type {
  CreateLocationBody,
  UpdateLocationBody,
  UpdateHoursBody,
  CreateHolidayBody,
  VenueStaffActor,
} from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js'

const MAX_LOCATIONS_BY_TIER: Record<string, number> = {
  basic: 1,
  pro:   10,
  elite: Infinity,
}

const NEXT_TIER: Record<string, 'pro' | 'elite'> = {
  basic: 'pro',
  pro:   'elite',
}

const DEFAULT_OPERATING_HOURS = Array.from({ length: 7 }, (_, day_of_week) => ({
  day_of_week,
  open_time:  '06:00',
  close_time: '22:00',
  is_closed:  false,
}))

function serializeOperatingHour(hour: OperatingHour) {
  return {
    day_of_week: hour.day_of_week,
    open_time:   hour.open_time,
    close_time:  hour.close_time,
    is_closed:   hour.is_closed,
  }
}

function serializeHoliday(holiday: LocationHoliday) {
  return {
    id:           holiday.id,
    holiday_date: holiday.date.toISOString().slice(0, 10),
    label:        holiday.label,
    full_day:     holiday.full_day,
    custom_open:  holiday.custom_open,
    custom_close: holiday.custom_close,
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

export async function listLocations(companyId: string, locationIds: string[]) {
  const where = {
    company_id: companyId,
    status:     'active',
    ...(locationIds.length > 0 ? { id: { in: locationIds } } : {}),
  }

  const locations = await prisma.location.findMany({
    where,
    include: {
      operating_hours: { orderBy: { day_of_week: 'asc' } },
      _count:          { select: { sub_venues: { where: { status: 'active' } } } },
    },
    orderBy: { display_order: 'asc' },
  })

  return locations.map((location) => ({
    id:               location.id,
    name:             location.name,
    address:          location.address,
    city:             location.city,
    phone:            location.phone,
    timezone:         location.timezone,
    status:           location.status,
    display_order:    location.display_order,
    operating_hours:  location.operating_hours.map(serializeOperatingHour),
    sub_venues_count: location._count.sub_venues,
  }))
}

export async function createLocation(
  companyId: string,
  tier: VenueStaffActor['tier'],
  data: CreateLocationBody,
) {
  const currentCount = await prisma.location.count({
    where: { company_id: companyId, status: 'active' },
  })
  const max = MAX_LOCATIONS_BY_TIER[tier] ?? 1
  if (currentCount >= max) {
    throw new ForbiddenError('Location limit reached for your current plan', {
      required_tier: NEXT_TIER[tier],
    })
  }

  const location = await prisma.$transaction(async (tx) => {
    const created = await tx.location.create({
      data: {
        company_id:    companyId,
        name:          data.name,
        address:       data.address,
        city:          data.city,
        timezone:      data.timezone,
        phone:         data.phone,
        display_order: data.display_order ?? 0,
      },
    })

    await tx.operatingHour.createMany({
      data: DEFAULT_OPERATING_HOURS.map((hour) => ({ location_id: created.id, ...hour })),
    })

    return created
  })

  return getLocation(location.id, companyId)
}

export async function getLocation(locationId: string, companyId: string) {
  const location = await prisma.location.findFirst({
    where:   { id: locationId, company_id: companyId },
    include: {
      operating_hours: { orderBy: { day_of_week: 'asc' } },
      holidays:        { orderBy: { date: 'asc' } },
      _count:          { select: { sub_venues: { where: { status: 'active' } } } },
    },
  })

  if (!location) {
    throw new NotFoundError('Location')
  }

  return {
    id:               location.id,
    name:             location.name,
    address:          location.address,
    city:             location.city,
    phone:            location.phone,
    timezone:         location.timezone,
    status:           location.status,
    display_order:    location.display_order,
    operating_hours:  location.operating_hours.map(serializeOperatingHour),
    holidays:         location.holidays.map(serializeHoliday),
    sub_venues_count: location._count.sub_venues,
  }
}

export async function updateLocation(locationId: string, companyId: string, data: UpdateLocationBody) {
  await getOwnedLocation(locationId, companyId)

  await prisma.location.update({
    where: { id: locationId },
    data:  {
      name:          data.name,
      address:       data.address,
      city:          data.city,
      timezone:      data.timezone,
      phone:         data.phone,
      status:        data.status,
      display_order: data.display_order,
    },
  })

  return getLocation(locationId, companyId)
}

export async function updateHours(locationId: string, companyId: string, hours: UpdateHoursBody['hours']) {
  await getOwnedLocation(locationId, companyId)

  await prisma.$transaction(
    hours.map((hour) =>
      prisma.operatingHour.upsert({
        where:  { location_id_day_of_week: { location_id: locationId, day_of_week: hour.day_of_week } },
        create: {
          location_id: locationId,
          day_of_week: hour.day_of_week,
          open_time:   hour.open_time,
          close_time:  hour.close_time,
          is_closed:   hour.is_closed,
        },
        update: {
          open_time:  hour.open_time,
          close_time: hour.close_time,
          is_closed:  hour.is_closed,
        },
      }),
    ),
  )

  const updatedHours = await prisma.operatingHour.findMany({
    where:   { location_id: locationId },
    orderBy: { day_of_week: 'asc' },
  })

  return updatedHours.map(serializeOperatingHour)
}

export async function listHolidays(locationId: string, companyId: string) {
  await getOwnedLocation(locationId, companyId)

  const holidays = await prisma.locationHoliday.findMany({
    where:   { location_id: locationId },
    orderBy: { date: 'asc' },
  })

  return holidays.map(serializeHoliday)
}

export async function createHoliday(locationId: string, companyId: string, data: CreateHolidayBody) {
  await getOwnedLocation(locationId, companyId)

  try {
    const holiday = await prisma.locationHoliday.create({
      data: {
        location_id:  locationId,
        date:         new Date(data.holiday_date),
        label:        data.label,
        full_day:     data.full_day,
        custom_open:  data.custom_open,
        custom_close: data.custom_close,
      },
    })

    return serializeHoliday(holiday)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('A holiday already exists for this date')
    }
    throw err
  }
}

export async function deleteHoliday(locationId: string, companyId: string, holidayId: string) {
  await getOwnedLocation(locationId, companyId)

  const holiday = await prisma.locationHoliday.findFirst({
    where: { id: holidayId, location_id: locationId },
  })
  if (!holiday) {
    throw new NotFoundError('Holiday')
  }

  await prisma.locationHoliday.delete({ where: { id: holidayId } })

  return { message: 'Holiday deleted' }
}

export async function deleteLocation(locationId: string, companyId: string) {
  await getOwnedLocation(locationId, companyId)

  const futureBooking = await prisma.booking.findFirst({
    where: {
      status:    { not: 'cancelled' },
      time_slot: {
        sub_venue:  { location_id: locationId },
        start_time: { gt: new Date() },
      },
    },
  })

  if (futureBooking) {
    throw new ConflictError('Cannot delete a location with upcoming bookings')
  }

  await prisma.location.update({ where: { id: locationId }, data: { status: 'inactive' } })

  return { message: 'Location deactivated' }
}
