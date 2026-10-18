import { z } from "zod"

import { link, text } from "../common"

const category = z.object({ label: text, description: text })

/** settings.consent — banner copy (Phase 8 renders it only when tracking is enabled). */
export const consentSettings = z.object({
  title: text,
  body: text,
  acceptLabel: text,
  rejectLabel: text,
  customiseLabel: text,
  saveLabel: text,
  /** The small button that reopens the banner after a choice (withdrawal). */
  manageLabel: text,
  policyLink: link,
  categories: z.object({
    necessary: category,
    analytics: category,
    marketing: category,
  }),
})
export type ConsentSettings = z.infer<typeof consentSettings>
