import { z } from "zod"

import { listQuery, sortParam } from "./list"

/** Largest accepted file (spec §11). The request body may add a small multipart envelope. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
/** <input accept>: the server sniffs the bytes anyway. */
export const ACCEPTED_IMAGE_TYPES =
  "image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
export const ACCEPTED_UPLOAD_TYPES = `${ACCEPTED_IMAGE_TYPES},application/pdf`

export const MEDIA_KINDS = ["image", "document"] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

/** GET /api/v1/admin/media (library + picker). */
export const mediaListQuery = listQuery.extend({
  sort: sortParam(["createdAt", "alt"], { field: "createdAt", dir: "desc" }),
  /** "image" = image/*, "document" = everything else (PDF); omitted = all. */
  kind: z.enum(MEDIA_KINDS).optional(),
})
export type MediaListQuery = z.output<typeof mediaListQuery>

export type MediaDriverName = "static" | "disk" | "r2"

export type MediaItem = {
  id: string
  url: string
  alt: string
  mime: string
  width: number | null
  height: number | null
  size: number
  createdAt: string
  updatedAt: string
  originalName: string
  driver: MediaDriverName
  focalX: number | null
  focalY: number | null
}
