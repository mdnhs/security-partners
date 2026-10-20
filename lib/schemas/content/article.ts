import { z } from "zod"

import { mediaRef, richText, slug, text } from "../common"

/**
 * The draft/published payload of an article. lead falls back to the
 * excerpt, empty tags fall back to the category name and a null body shows
 * the excerpt (articles seeded without designed copy).
 */
export const articleContent = z.object({
  title: text,
  excerpt: text,
  cover: mediaRef,
  lead: text.nullable(),
  tags: z.array(text),
  body: richText.nullable(),
})

/** An article as edited: slug, relations (columns) + payload. */
export const articleSchema = articleContent.extend({
  slug,
  categoryId: z.uuid(),
  authorId: z.uuid().nullable(),
})

export type ArticleContent = z.infer<typeof articleContent>
export type ArticleInput = z.infer<typeof articleSchema>
