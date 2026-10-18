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

export const MEDIA_ALT_MAX = 500

/**
 * Control, zero-width and bidi characters: never meaningful in alt text,
 * and they could disguise it in the library or for screen readers.
 */
const ALT_HIDDEN_CHARS =
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g

/** Alt text as stored: hidden characters removed, trimmed. */
export const cleanAltText = (value: string) =>
  value.replace(ALT_HIDDEN_CHARS, "").trim()

/** PATCH /media/:id. focal: point to keep in view when cropped (0..1 from the left/top); null resets. */
export const mediaUpdateInput = z
  .object({
    alt: z
      .string()
      .max(MEDIA_ALT_MAX, `Up to ${MEDIA_ALT_MAX} characters`)
      .transform(cleanAltText)
      .optional(),
    focal: z
      .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
      .nullable()
      .optional(),
  })
  .refine((v) => v.alt !== undefined || v.focal !== undefined, {
    message: "Nothing to update",
  })
export type MediaUpdateInput = z.output<typeof mediaUpdateInput>

/** One place a file is used (media_usages row with a readable label). */
export type MediaUsage = {
  entityType: string
  entityId: string
  field: string
  label: string
  href: string | null
}
