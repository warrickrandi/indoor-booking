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

  const { data: venues, meta } = await fetchPublic<VenueCardData[]>(`/marketplace/venues?${query.toString()}`)

  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1
  const dateSuffix = params.date ? `?date=${params.date}` : ''

  const buildPageLink = (targetPage: number) => {
    const linkParams = new URLSearchParams(query)
    linkParams.set('page', String(targetPage))
    return `/venues?${linkParams.toString()}`
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Find a venue</h1>
        <p className="text-muted-foreground">Browse futsal, badminton, cricket and playhouse venues near you</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <aside>
          <VenueFilters sportType={params.sport_type} city={params.city} date={params.date} />
        </aside>

        <div>
          {venues.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No venues found"
              description="Try adjusting your filters to find more venues."
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {venues.map((venue) => (
                  <VenueCard key={venue.slug} venue={venue} href={`/venues/${venue.slug}${dateSuffix}`} />
                ))}
              </div>

              {meta && totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {meta.page} of {totalPages} &middot; {meta.total} venues
                  </p>
                  <div className="flex gap-2">
                    {page > 1 ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={buildPageLink(page - 1)}>
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                    )}
                    {page < totalPages ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={buildPageLink(page + 1)}>
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
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
      </div>
    </div>
  )
}
