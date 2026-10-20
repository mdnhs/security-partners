import { z } from "zod"

import { href, mediaRef, pageHero, text } from "@/lib/schemas/common"

/** Page "contact" (/contact). The contact section and map are settings.sections.contact. */
export const contactTemplate = z.object({
  hero: pageHero,
  departments: z.object({
    eyebrow: text,
    heading: text,
    intro: text,
    items: z
      .array(
        z.object({
          title: text,
          icon: mediaRef,
          name: text,
          role: text,
          lines: z.array(z.object({ text, href })).min(1),
        })
      )
      .min(1),
  }),
})
export type ContactTemplate = z.infer<typeof contactTemplate>
