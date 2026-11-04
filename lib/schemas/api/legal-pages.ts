import { z } from "zod"

import {
  isReservedLegalSlug,
  LEGAL_SLUG_MAX,
  LEGAL_SLUG_PATTERN,
} from "@/lib/legal-slug"
import type { LegalTemplate } from "@/templates/legal/schema"

import type { ContentStatus, VersionedDto } from "./content"

/** A legal page's address is /<slug> (lib/legal-slug.ts). */
export const legalSlug = z
  .string()
  .regex(LEGAL_SLUG_PATTERN, "Use lower-case words joined by hyphens")
  .max(LEGAL_SLUG_MAX)
  .refine((slug) => !isReservedLegalSlug(slug), "This address is reserved")

export const legalPath = (slug: string) => `/${slug}`

/** revisions / media_usages / audit entity type of legal pages. */
export const LEGAL_ENTITY = "legal-page"

export const newLegalPageInput = z.object({
  title: z.string().trim().min(1).max(80),
  slug: legalSlug,
})
export type NewLegalPageInput = z.infer<typeof newLegalPageInput>

export const legalMetaInput = z
  .object({
    version: z.number().int().min(1),
    title: z.string().trim().min(1).max(80).optional(),
    slug: legalSlug.optional(),
  })
  .refine((input) => input.title !== undefined || input.slug !== undefined, {
    message: "Change the title or the address",
  })
export type LegalMetaInput = z.infer<typeof legalMetaInput>

/** PUT /order: every legal page id, in footer order. */
export const legalOrderInput = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
})
export type LegalOrderInput = z.infer<typeof legalOrderInput>

export type LegalPageDto = VersionedDto<LegalTemplate> & {
  id: string
  slug: string
  title: string
  path: string
  sortOrder: number
  createdAt: string
}

export type LegalPageListItem = {
  id: string
  slug: string
  title: string
  path: string
  status: ContentStatus
  hasUnpublishedChanges: boolean
  sortOrder: number
  updatedAt: string
  updatedByName: string | null
}
