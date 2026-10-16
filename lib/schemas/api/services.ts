import { z } from "zod"

import { slug } from "@/lib/schemas/common"

import type { VersionedDto } from "./content"
import { listQuery, sortParam } from "./list"

export const serviceListQuery = listQuery.extend({
  sort: sortParam(["sortOrder", "title", "updatedAt"], {
    field: "sortOrder",
    dir: "asc",
  }),
})
export type ServiceListQuery = z.output<typeof serviceListQuery>

/** POST /services — draft is validated against serviceContent by the service. */
export const createServiceInput = z.object({ slug, draft: z.unknown() })

/** PATCH /services/:id/slug — changes the public URL immediately. */
export const serviceSlugInput = z.object({
  slug,
  version: z.number().int().min(1),
})

export const serviceVersionQuery = z.object({
  version: z.coerce.number().int().min(1),
})

export type ServiceDto = VersionedDto<unknown> & {
  id: string
  slug: string
  sortOrder: number
  title: string
}

export type ServiceListItem = Omit<ServiceDto, "draft" | "published">
