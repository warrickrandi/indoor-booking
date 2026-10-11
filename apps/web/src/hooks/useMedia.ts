import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { del, get, patch, post, put, showApiErrorToast, uploadFile } from '@/lib/api'

export interface VenueMediaItem {
  id: string
  type: 'image' | 'video'
  url: string
  embed_url: string | null
  caption: string | null
  is_cover: boolean
  display_order: number
}

const MEDIA_KEY = ['venue-media'] as const

export function useMedia() {
  return useQuery({
    queryKey: MEDIA_KEY,
    queryFn: async () => (await get<VenueMediaItem[]>('/media')).data,
  })
}

export function useMediaActions() {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: MEDIA_KEY })

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return (await uploadFile<VenueMediaItem>('/media/images', formData)).data
    },
    onSuccess: refresh,
    onError: showApiErrorToast,
  })

  const addVideo = useMutation({
    mutationFn: async (input: { url: string; caption?: string }) => (await post<VenueMediaItem>('/media/videos', input)).data,
    onSuccess: refresh,
    onError: showApiErrorToast,
  })

  const update = useMutation({
    mutationFn: async ({ id, ...body }: { id: string; caption?: string | null; is_cover?: boolean }) =>
      (await patch<VenueMediaItem>(`/media/${id}`, body)).data,
    onSuccess: refresh,
    onError: showApiErrorToast,
  })

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => (await put<VenueMediaItem[]>('/media/reorder', { ids })).data,
    onSuccess: refresh,
    onError: showApiErrorToast,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => (await del<{ deleted: boolean }>(`/media/${id}`)).data,
    onSuccess: refresh,
    onError: showApiErrorToast,
  })

  return { uploadImage, addVideo, update, reorder, remove }
}
