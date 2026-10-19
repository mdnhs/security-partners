import { z } from "zod"

import { type BuilderDocument, DraftDocument } from "@/blocks/document"
import type { Seo } from "@/lib/schemas/common"

import type { ContentStatus, VersionedDto } from "./content"

/**
 * Slugs under /p/ that are refused although they fit the format: they read
 * as the site's own areas (Review Focus 1, "/p/admin").
 */
export const RESERVED_BUILDER_SLUGS = [
  "admin",
  "api",
  "og",
  "images",
  "p",
] as const

const RESERVED = new Set<string>(RESERVED_BUILDER_SLUGS)

/** A builder page's address is always /p/<slug>. */
export const builderSlug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lower-case words joined by hyphens")
  .max(60)
  .refine((slug) => !RESERVED.has(slug), "This address is reserved")

export const builderPath = (slug: string) => `/p/${slug}`

/** revisions / media_usages / audit entity type of builder pages. */
export const BUILDER_ENTITY = "builder-page"

export const newBuilderPageInput = z.object({
  title: z.string().trim().min(1).max(80),
  slug: builderSlug,
})
export type NewBuilderPageInput = z.infer<typeof newBuilderPageInput>

/** POST /builder-pages: `seed` = a copied fixed page's blocks (loose, like a draft). */
export const createBuilderPageInput = newBuilderPageInput.extend({
  seed: DraftDocument.optional(),
})

export const builderDraftInput = z.object({
  version: z.number().int().min(1),
  draft: DraftDocument,
})
export type BuilderDraftInput = z.infer<typeof builderDraftInput>

export const builderMetaInput = z
  .object({
    version: z.number().int().min(1),
    title: z.string().trim().min(1).max(80).optional(),
    slug: builderSlug.optional(),
  })
  .refine((input) => input.title !== undefined || input.slug !== undefined, {
    message: "Change the title or the address",
  })
export type BuilderMetaInput = z.infer<typeof builderMetaInput>

/** DELETE /builder-pages/:id?redirectHome=true → 301 /p/<slug> → /. */
export const builderDeleteQuery = z.object({
  redirectHome: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
})

/** `draft` is the loose working copy; `published` always passed validateDocument. */
export type BuilderPageDto = Omit<
  VersionedDto<BuilderDocument>,
  "draft" | "published"
> & {
  draft: DraftDocument
  published: BuilderDocument | null
  id: string
  slug: string
  title: string
  path: string
  seo: Seo
  createdAt: string
}

export type BuilderPageListItem = {
  id: string
  slug: string
  title: string
  path: string
  status: ContentStatus
  hasUnpublishedChanges: boolean
  updatedAt: string
  updatedByName: string | null
}
