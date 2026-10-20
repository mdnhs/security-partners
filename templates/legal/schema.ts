import { z } from "zod"

import { pageHero, richText } from "@/lib/schemas/common"

/** Pages "privacy" and "terms": PageHero + article-styled rich text. */
export const legalTemplate = z.object({ hero: pageHero, body: richText })
export type LegalTemplate = z.infer<typeof legalTemplate>
