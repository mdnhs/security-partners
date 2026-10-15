import { z } from "zod"

import { mediaRef, text } from "../common"

/** settings.site — brand and locale (spec §5.4, D7). */
export const siteSettings = z.object({
  name: text,
  legalName: text,
  logo: mediaRef,
  logoAlt: text,
  logoOnDark: mediaRef.nullable(),
  favicon: mediaRef.nullable(),
  productionUrl: z.url().nullable(),
  timezone: text,
  /** <html lang> of the public site. */
  locale: text,
  copyright: text,
})
export type SiteSettings = z.infer<typeof siteSettings>
