import { z } from "zod"

import { pageHero, text } from "@/lib/schemas/common"
import { SERVICES_SECTIONS, sectionList } from "@/templates/shared/sections"

/** Page "services" (/services). Cards come from the services collection. */
export const servicesTemplate = z.object({
  hero: pageHero,
  servicesSection: z.object({ eyebrow: text, heading: text, intro: text }),
  /** Which sections after the hero show, and in what order. */
  sections: sectionList(SERVICES_SECTIONS),
})
export type ServicesTemplate = z.infer<typeof servicesTemplate>
