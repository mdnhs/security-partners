import { z } from "zod"

import { pageHero, text } from "@/lib/schemas/common"

/** Page "services" (/services). Cards come from the services collection. */
export const servicesTemplate = z.object({
  hero: pageHero,
  servicesSection: z.object({ eyebrow: text, heading: text, intro: text }),
})
export type ServicesTemplate = z.infer<typeof servicesTemplate>
