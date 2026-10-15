import { z } from "zod"

import { slug, text } from "../common"

/** article_categories; showInFilter drives the blog filter bar and article sidebar. */
export const categorySchema = z.object({
  slug,
  name: text,
  showInFilter: z.boolean(),
})
export type CategoryInput = z.infer<typeof categorySchema>
