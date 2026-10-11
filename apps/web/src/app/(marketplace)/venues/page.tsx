import Link from 'next/link'
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react'

import { fetchPublic } from '@/lib/server-api'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { VenueCard, type VenueCardData } from '@/components/marketplace/VenueCard'
import { VenueFilters } from './venue-filters'

const PAGE_LIMIT = 12

interface VenuesPageProps {
  searchParams: Promise<{
    sport_type?: string
    city?: string
    date?: string
    page?: string
  }>
}

export default async function VenuesPage({ searchParams }: VenuesPageProps) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const query = new URLSearchParams()
  if (params.sport_type) query.set('sport_type', params.sport_type)
  if (params.city) query.set('city', params.city)
  query.set('page', String(page))
  query.set('limit', String(PAGE_LIMIT))

  let venues: VenueCardData[] = []
  let meta: { page: number; limit: number; total: number } | undefined

  try {
    const result = await fetchPublic<VenueCardData[]>(`/marketplace/venues?${query.toString()}`)
    venues = result.data
    meta = result.meta
  } catch {
    // API unreachable or error — render empty listing rather than crash
  }

  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1
  const dateSuffix = params.date ? `?date=${params.date}` : ''

  const buildPageLink = (targetPage: number) => {
    const linkParams = new URLSearchParams(query)
    linkParams.set('page', String(targetPage))
    if (params.date) linkParams.set('date', params.date)
    return `/venues?${linkParams.toString()}`
  }

  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <div className="court-lines absolute inset-0 -z-10 opacity-70" />
        <div className="absolute -right-20 -top-20 -z-10 h-72 w-72 rounded-full bg-volt/20 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="text-4xl font-extrabold sm:text-5xl">Find a venue</h1>
          <p className="mt-2 mb-8 max-w-xl text-white/70">
            Futsal, badminton, cricket and playhouse venues. Filter, pick a date and book.
          </p>
          <VenueFilters sportType={params.sport_type} city={params.city} date={params.date} />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {meta && venues.length > 0 && (
          <p className="mb-6 text-sm text-muted-foreground">
            {meta.total} {meta.total === 1 ? 'venue' : 'venues'} found
          </p>
        )}

        {venues.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No venues found"
            description="Try a different sport or city, or clear your filters."
          />
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {venues.map((venue) => (
                <VenueCard key={venue.slug} venue={venue} href={`/venues/${venue.slug}${dateSuffix}`} />
              ))}
            </div>

            {meta && totalPages > 1 && (
              <div className="mt-10 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {meta.page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Button variant="outline" asChild>
                      <Link href={buildPageLink(page - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" disabled>
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                  )}
                  {page < totalPages ? (
                    <Button variant="outline" asChild>
                      <Link href={buildPageLink(page + 1)}>
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" disabled>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
