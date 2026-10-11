'use client'

import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, PlayCircle, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/store/auth.store'
import { useMedia, useMediaActions, type VenueMediaItem } from '@/hooks/useMedia'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

function MediaTile({
  item,
  index,
  total,
  onMove,
}: {
  item: VenueMediaItem
  index: number
  total: number
  onMove: (from: number, to: number) => void
}) {
  const { update, remove } = useMediaActions()
  const [caption, setCaption] = useState(item.caption ?? '')

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-video bg-muted">
        {item.type === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.caption ?? 'Venue photo'} className="h-full w-full object-cover" />
        ) : (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <PlayCircle className="h-10 w-10" />
            <span className="px-3 text-center text-xs">Video &middot; opens the link</span>
          </a>
        )}
        {item.is_cover && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-volt">
            <Star className="h-3 w-3" /> Cover
          </span>
        )}
      </div>
      <div className="space-y-3 p-3">
        <Input
          value={caption}
          maxLength={200}
          placeholder="Add a caption (optional)"
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => {
            if (caption !== (item.caption ?? '')) update.mutate({ id: item.id, caption: caption || null })
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <Button size="icon" variant="outline" aria-label="Move earlier" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" aria-label="Move later" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-1">
            {item.type === 'image' && !item.is_cover && (
              <Button size="sm" variant="outline" onClick={() => update.mutate({ id: item.id, is_cover: true })}>
                <Star className="h-4 w-4" />
                Make cover
              </Button>
            )}
            <Button
              size="icon"
              variant="outline"
              aria-label="Delete"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm('Delete this item? This cannot be undone.')) remove.mutate(item.id)
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MediaPage() {
  const actor = useAuthStore((state) => state.actor)
  const media = useMedia()
  const { uploadImage, addVideo, reorder } = useMediaActions()
  const fileInput = useRef<HTMLInputElement>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoCaption, setVideoCaption] = useState('')
  const [uploading, setUploading] = useState(false)

  const canView = actor?.permissions.includes('company.branding') ?? false
  if (!canView) {
    return <EmptyState title="Access denied" description="You do not have permission to manage media." />
  }

  const items = media.data ?? []

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: only JPEG, PNG or WEBP images are allowed`)
        continue
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: image is larger than 5MB`)
        continue
      }
      try {
        await uploadImage.mutateAsync(file)
      } catch {
        break // the error toast is already shown; stop so we do not spam one per file
      }
    }
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  const move = (from: number, to: number) => {
    const ids = items.map((m) => m.id)
    const [moved] = ids.splice(from, 1)
    if (moved) ids.splice(to, 0, moved)
    reorder.mutate(ids)
  }

  const submitVideo = (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoUrl.trim()) return
    addVideo.mutate(
      { url: videoUrl.trim(), caption: videoCaption.trim() || undefined },
      {
        onSuccess: () => {
          setVideoUrl('')
          setVideoCaption('')
          toast.success('Video added')
        },
      },
    )
  }

  return (
    <div>
      <PageHeader
        title="Photos & videos"
        description="Show players what your venue looks like. The cover photo appears on your venue card and page header."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add photos</CardTitle>
            <CardDescription>JPEG, PNG or WEBP, up to 5MB each.</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED.join(',')}
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {uploading ? 'Uploading...' : 'Choose photos'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add a video</CardTitle>
            <CardDescription>Paste a YouTube or Vimeo link.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitVideo} className="space-y-3">
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                inputMode="url"
              />
              <Input
                value={videoCaption}
                maxLength={200}
                onChange={(e) => setVideoCaption(e.target.value)}
                placeholder="Caption (optional)"
              />
              <Button type="submit" disabled={addVideo.isPending || !videoUrl.trim()}>
                {addVideo.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add video
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className={cn('mt-8', reorder.isPending && 'opacity-60')}>
        {media.isLoading ? (
          <LoadingPanel />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ImagePlus}
            title="No photos or videos yet"
            description="Add a few photos of your courts. Venues with photos get noticed more."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item, index) => (
              <MediaTile key={item.id} item={item} index={index} total={items.length} onMove={move} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
