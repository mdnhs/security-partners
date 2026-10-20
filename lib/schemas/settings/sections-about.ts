import { z } from "zod"

import { mediaRef, paragraphsText, text } from "../common"

/** settings.sections.about — About section shared by / and /about (ruling). */
export const aboutSectionSettings = z.object({
  eyebrow: text,
  heading: text,
  body: paragraphsText,
  image: mediaRef,
  imageAlt: text,
  badge: z.object({ value: text, label: text, caption: text }),
  highlights: z.array(text).min(1),
})
export type AboutSectionSettings = z.infer<typeof aboutSectionSettings>
