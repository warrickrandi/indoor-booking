import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
}

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'admin', 'api'])

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname !== '/') {
    return NextResponse.next()
  }

  const host = req.headers.get('host') ?? ''
  const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'localhost:3000'

  if (host === PLATFORM_DOMAIN || host.startsWith('localhost')) {
    return NextResponse.next()
  }

  let slug: string | null = null

  if (host.endsWith(`.${PLATFORM_DOMAIN}`)) {
    const sub = host.slice(0, -(PLATFORM_DOMAIN.length + 1))
    if (sub && !RESERVED_SUBDOMAINS.has(sub)) {
      slug = sub
    }
  } else {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/marketplace/resolve-domain?host=${encodeURIComponent(host)}`)
      if (res.ok) {
        const body = (await res.json()) as { data?: { slug?: string } }
        slug = body.data?.slug ?? null
      }
    } catch {
      // DNS/network failure — fall through to normal routing
    }
  }

  if (!slug) {
    return NextResponse.next()
  }

  const url = req.nextUrl.clone()
  url.pathname = `/venues/${slug}`
  const response = NextResponse.rewrite(url)
  response.headers.set('x-company-slug', slug)
  return response
}
