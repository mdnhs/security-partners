"use client"

import { useQuery } from "@tanstack/react-query"

import { api, unwrap } from "@/lib/api-client"

/** One library item (thumbnail + alt) for a `{ mediaId }` reference. */
export function useMediaItem(mediaId: string | null | undefined) {
  return useQuery({
    queryKey: ["media", "item", mediaId],
    queryFn: () => unwrap(api.media[":id"].$get({ param: { id: mediaId! } })),
    enabled: !!mediaId,
    staleTime: 5 * 60_000,
  })
}
