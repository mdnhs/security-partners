import { z } from "zod"

/** settings.customCode — owner-only snippets (Phase 8 injects them). */
export const customCodeSettings = z.object({
  headHtml: z.string().max(20000),
  bodyEndHtml: z.string().max(20000),
})
export type CustomCodeSettings = z.infer<typeof customCodeSettings>
