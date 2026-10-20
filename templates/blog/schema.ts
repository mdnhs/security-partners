import { z } from "zod"

import { pageHero, slug } from "@/lib/schemas/common"

/** Page "blog" (/blog): featured article (by slug) and posts per page. */
export const blogTemplate = z.object({
  hero: pageHero,
  featuredArticle: slug.nullable(),
  pageSize: z.number().int().min(1).max(24),
})
export type BlogTemplate = z.infer<typeof blogTemplate>
