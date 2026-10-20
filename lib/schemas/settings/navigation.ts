import { z } from "zod"

import { link } from "../common"

/** settings.navigation — header links (also the footer Quick Links) and CTA. */
export const navigationSettings = z.object({
  headerLinks: z.array(link).min(1),
  headerCta: link,
})
export type NavigationSettings = z.infer<typeof navigationSettings>
