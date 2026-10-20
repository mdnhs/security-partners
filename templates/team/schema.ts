import { z } from "zod"

import { iconCard, mediaRef, pageHero, text } from "@/lib/schemas/common"

/** Page "team" (/team). photoPlaceholder sits behind every member photo (also on /). */
export const teamTemplate = z.object({
  hero: pageHero,
  leadership: z.object({
    eyebrow: text,
    heading: text,
    intro: text,
    photoPlaceholder: mediaRef,
  }),
  officers: z.object({
    eyebrow: text,
    title: text,
    description: text,
    qualities: z.array(iconCard).min(1),
  }),
})
export type TeamTemplate = z.infer<typeof teamTemplate>
