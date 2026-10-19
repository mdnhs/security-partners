import { z } from "zod"

export const PREVIEW_ENTITIES = [
  "page",
  "service",
  "article",
  "settings",
  "builder-page",
] as const
export type PreviewEntity = (typeof PREVIEW_ENTITIES)[number]

/** GET /api/v1/admin/preview?entity=page&id=home */
export const previewQuery = z.object({
  entity: z.enum(PREVIEW_ENTITIES),
  id: z.string().min(1).max(100),
})

/** Admin URL that opens the draft of a record on the public site (new tab). */
export function previewHref(entity: PreviewEntity, id: string): string {
  return `/api/v1/admin/preview?${new URLSearchParams({ entity, id })}`
}
