import { z } from "zod"

import { iconCard, pageHero, text } from "@/lib/schemas/common"
import { ABOUT_SECTIONS, sectionList } from "@/templates/shared/sections"

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
  /** Which sections after the hero show, and in what order. */
  sections: sectionList(ABOUT_SECTIONS),
})
export type AboutTemplate = z.infer<typeof aboutTemplate>
