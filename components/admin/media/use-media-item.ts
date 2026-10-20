"use client"

import { useQuery } from "@tanstack/react-query"

import { api, unwrap } from "@/lib/api-client"
import { isMediaId } from "@/lib/media"

/** One library item (thumbnail + alt) for a `{ mediaId }` reference. */
export function useMediaItem(mediaId: string | null | undefined) {
  return useQuery({
    queryKey: ["media", "item", mediaId],
    // The Hono client does not encode path params, and encoding leaves "."
    // and ".." as dot segments: only a UUID is ever fetched, encoded as
    // defence in depth (reviews D1.1 I1, N2).
    queryFn: () =>
      unwrap(
        api.media[":id"].$get({ param: { id: encodeURIComponent(mediaId!) } })
      ),
    enabled: isMediaId(mediaId),
    staleTime: 5 * 60_000,
  })
}
