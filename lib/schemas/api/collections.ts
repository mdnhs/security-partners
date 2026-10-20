import { z } from "zod"

import type { MediaRef } from "@/lib/schemas/common"
import { categorySchema } from "@/lib/schemas/content/category"
import { clientSchema } from "@/lib/schemas/content/client"
import { groupCompanySchema } from "@/lib/schemas/content/group-company"
import { teamMemberSchema } from "@/lib/schemas/content/team-member"

import { listQuery, sortParam } from "./list"

/** Small collections: edits publish immediately (spec §5.3). URL segment → record schema. */
export const COLLECTIONS = [
  "team",
  "clients",
  "group-companies",
  "categories",
] as const
export type CollectionName = (typeof COLLECTIONS)[number]

export const collectionSchemas = {
  team: teamMemberSchema,
  clients: clientSchema,
  "group-companies": groupCompanySchema,
  categories: categorySchema,
} as const satisfies Record<CollectionName, z.ZodObject>

export type CollectionInput<C extends CollectionName> = z.output<
  (typeof collectionSchemas)[C]
>

/** Wire shape: the record's fields plus id, sortOrder, updatedAt. */
export type CollectionItem<C extends CollectionName> = CollectionInput<C> & {
  id: string
  sortOrder: number
  updatedAt: string
}

export type TeamItem = CollectionItem<"team">
export type ClientItem = CollectionItem<"clients">
export type GroupCompanyItem = CollectionItem<"group-companies">
export type CategoryItem = CollectionItem<"categories"> & {
  articleCount: number
}

export const collectionListQuery = listQuery.extend({
  sort: sortParam(["sortOrder", "name", "updatedAt"], {
    field: "sortOrder",
    dir: "asc",
  }),
})
export type CollectionListQuery = z.output<typeof collectionListQuery>

/** PUT /reorder/:collection — every id of the collection, in the new order. */
export const REORDERABLE = ["services", ...COLLECTIONS] as const
export type Reorderable = (typeof REORDERABLE)[number]
export const reorderParam = z.object({ collection: z.enum(REORDERABLE) })
export const reorderInput = z.object({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate ids"),
})

export type { MediaRef }
