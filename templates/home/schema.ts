import { z } from "zod"

import { link, mediaRef, text } from "@/lib/schemas/common"
import { HOME_SECTIONS, sectionList } from "@/templates/shared/sections"

const sectionCopy = z.object({ eyebrow: text, heading: text, intro: text })

/** Page "home" (/): hero, section headings and how many posts the blog strip shows. */
export const homeTemplate = z.object({
  hero: z.object({
    eyebrow: text,
    heading: text,
    tagline: text,
    subheading: text,
    backgroundImage: mediaRef,
    primaryCta: link,
    secondaryCta: link,
    stats: z
      .array(
        z.object({
          value: text,
          label: text,
          /** Counts up from 0 to this number on load (GSAP data-count). */
          count: z.number().int().min(0).optional(),
          suffix: z.string().max(10).optional(),
        })
      )
      .min(1),
  }),
  services: sectionCopy,
  team: sectionCopy,
  blog: sectionCopy.extend({
    cta: link,
    count: z.number().int().min(1).max(12),
  }),
  /** Which sections after the hero show, and in what order. */
  sections: sectionList(HOME_SECTIONS),
})
export type HomeTemplate = z.infer<typeof homeTemplate>
