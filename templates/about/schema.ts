import { z } from "zod"

import { iconCard, pageHero, text } from "@/lib/schemas/common"

/** Page "about" (/about). The About section itself is settings.sections.about. */
export const aboutTemplate = z.object({
  hero: pageHero,
  stats: z
    .array(z.object({ value: text, label: text, description: text }))
    .min(1),
  values: z.object({
    eyebrow: text,
    title: text,
    description: text,
    items: z.array(iconCard).min(1),
  }),
})
export type AboutTemplate = z.infer<typeof aboutTemplate>
