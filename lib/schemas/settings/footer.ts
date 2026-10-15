import { z } from "zod"

import { link, text } from "../common"

/** settings.footer — footer copy and legal links. */
export const footerSettings = z.object({
  tagline: text,
  quickLinksHeading: text,
  contactHeading: text,
  contact: z.object({ telLabel: text, phone24hLabel: text }),
  groupHeading: text,
  groupTelLabel: text,
  legal: z.object({ privacy: link, terms: link }),
})
export type FooterSettings = z.infer<typeof footerSettings>
