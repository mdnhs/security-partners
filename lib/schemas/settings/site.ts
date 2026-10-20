import { z } from "zod"

import { httpUrl, mediaRef, text } from "../common"

/** settings.site — brand and locale (spec §5.4, D7). */
export const siteSettings = z.object({
  name: text,
  legalName: text,
  logo: mediaRef,
  logoAlt: text,
  logoOnDark: mediaRef.nullable(),
  /**
   * Lottie animation (JSON or dotLottie) played in a loop in place of the
   * logo in the header and footer; null = the image logo only. Saved values
   * from before this field read as null.
   */
  logoAnimation: mediaRef.nullable().default(null),
  favicon: mediaRef.nullable(),
  productionUrl: httpUrl.nullable(),
  timezone: text,
  /** <html lang> of the public site. */
  locale: text,
  copyright: text,
})
export type SiteSettings = z.infer<typeof siteSettings>
