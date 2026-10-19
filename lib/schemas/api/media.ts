import { z } from "zod"

import { stripHiddenChars } from "@/lib/hidden-chars"

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
  /** "true" = images with no alt text that are not marked decorative. */
  missingAlt: z.literal("true").optional(),
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
  /** Decorative: needs no alt text (any alt text entered is kept). */
  isDecorative: boolean
  caption: string
  /** Who uploaded it (null for seeded files): uploaders may describe their own files. */
  createdBy: string | null
}

export const MEDIA_ALT_MAX = 500
export const MEDIA_CAPTION_MAX = 300

/** Alt text as stored: hidden characters (lib/hidden-chars) removed, trimmed. */
export const cleanAltText = (value: string) => stripHiddenChars(value).trim()

/** PATCH /media/:id. caption: cleaned like alt text. focal: point to keep in view when cropped (0..1 from the left/top); null resets. */
export const mediaUpdateInput = z
  .object({
    alt: z
      .string()
      .max(MEDIA_ALT_MAX, `Up to ${MEDIA_ALT_MAX} characters`)
      .transform(cleanAltText)
      .optional(),
    isDecorative: z.boolean().optional(),
    caption: z
      .string()
      .max(MEDIA_CAPTION_MAX, `Up to ${MEDIA_CAPTION_MAX} characters`)
      .transform(cleanAltText)
      .optional(),
    focal: z
      .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
      .nullable()
      .optional(),
  })
  .refine(
    (v) =>
      v.alt !== undefined ||
      v.focal !== undefined ||
      v.isDecorative !== undefined ||
      v.caption !== undefined,
    { message: "Nothing to update" }
  )
export type MediaUpdateInput = z.output<typeof mediaUpdateInput>

/** One place a file is used (media_usages row with a readable label). */
export type MediaUsage = {
  entityType: string
  entityId: string
  field: string
  label: string
  href: string | null
}

/** Settings ▸ Integrations ▸ R2 "Move uploads to R2" (master 6.4). */
export type MediaMigrationStatus = {
  r2Configured: boolean
  /** Fixed text when saved R2 settings exist but cannot be read (e.g. undecryptable). */
  r2Error: string | null
  onDisk: number
  inR2: number
  /** stopped = the last run moved nothing (see `failed`); start it again after fixing. */
  state: "idle" | "queued" | "running" | "stopped"
  /** "<key>: <fixed reason>" of a stopped run. */
  failed: string[]
  lastRunAt: string | null
  lastError: string | null
}
