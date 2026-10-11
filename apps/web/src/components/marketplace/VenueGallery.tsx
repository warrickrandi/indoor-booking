'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

export interface GalleryMedia {
  id: string
  type: 'image' | 'video'
  url: string
  embed_url: string | null
  caption: string | null
  is_cover: boolean
}

interface VenueGalleryProps {
  media: GalleryMedia[]
  venueName: string
}

export function VenueGallery({ media, venueName }: VenueGalleryProps) {
  const images = media.filter((m) => m.type === 'image')
  const videos = media.filter((m) => m.type === 'video' && m.embed_url)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (images.length === 0 && videos.length === 0) return null

  const current = openIndex !== null ? images[openIndex] : undefined
  const step = (delta: number) =>
    setOpenIndex((i) => (i === null ? i : (i + delta + images.length) % images.length))

  return (
    <section className="mb-12">
      <h2 className="mb-4 text-2xl font-extrabold">Photos &amp; videos</h2>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:grid-rows-2">
          {images.slice(0, 5).map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`View photo ${index + 1} of ${images.length}`}
              className={cn(
                'group relative overflow-hidden rounded-2xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                index === 0 ? 'col-span-2 row-span-2 aspect-[4/3] md:aspect-auto' : 'aspect-[4/3]',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.caption ?? `${venueName} photo ${index + 1}`}
                loading={index === 0 ? 'eager' : 'lazy'}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {index === 4 && images.length > 5 && (
                <span className="absolute inset-0 flex items-center justify-center bg-ink/60 text-xl font-bold text-white">
                  +{images.length - 5} more
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <div className={cn('grid gap-4 sm:grid-cols-2', images.length > 0 && 'mt-4')}>
          {videos.map((video) => (
            <figure key={video.id} className="overflow-hidden rounded-2xl border bg-card">
              <div className="aspect-video">
                <iframe
                  src={video.embed_url ?? undefined}
                  title={video.caption ?? `${venueName} video`}
                  loading="lazy"
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="h-full w-full"
                />
              </div>
              {video.caption && <figcaption className="px-4 py-3 text-sm text-muted-foreground">{video.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      <Dialog open={openIndex !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent className="max-w-4xl border-0 bg-ink p-2 text-white sm:p-4">
          <DialogTitle className="sr-only">{venueName} photos</DialogTitle>
          <DialogDescription className="sr-only">Photo viewer. Use the arrow buttons to browse.</DialogDescription>
          {current && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.url}
                alt={current.caption ?? venueName}
                className="max-h-[75vh] w-full rounded-lg object-contain"
              />
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Previous photo"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="Next photo"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
              <p className="mt-3 text-center text-sm text-white/80">
                {current.caption ? `${current.caption} · ` : ''}
                {(openIndex ?? 0) + 1} / {images.length}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
