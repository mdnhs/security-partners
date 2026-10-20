import { z } from "zod"

import { link, mediaRef, text } from "../common"

/** settings.sections.enquireBanner — shared "Enquire About Our Services" banner (D10). */
export const enquireBannerSettings = z.object({
  image: mediaRef,
  eyebrow: text,
  heading: text,
  copy: text,
  cta: link,
  secondaryCta: link,
})
export type EnquireBannerSettings = z.infer<typeof enquireBannerSettings>
