import { z } from "zod"

import { listQuery, sortParam } from "./list"

/** GET /api/v1/admin/media (picker in Phase 4; Phase 6 adds upload and the library screen). */
export const mediaListQuery = listQuery.extend({
  sort: sortParam(["createdAt", "alt"], { field: "createdAt", dir: "desc" }),
  /** "image" = image/* only (pickers); omitted = everything. */
  kind: z.enum(["image"]).optional(),
})
export type MediaListQuery = z.output<typeof mediaListQuery>

export type MediaItem = {
  id: string
  url: string
  alt: string
  mime: string
  width: number | null
  height: number | null
  size: number
  createdAt: string
}
