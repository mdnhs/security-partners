import { z } from "zod"

import { iconCard, text } from "../common"

/** settings.sections.whyChooseUs — shared "Why Choose Us" section (D10). */
export const whyChooseUsSettings = z.object({
  eyebrow: text,
  heading: text,
  copy: text,
  features: z.array(iconCard).min(1),
})
export type WhyChooseUsSettings = z.infer<typeof whyChooseUsSettings>
