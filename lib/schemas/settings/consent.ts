import { z } from "zod"

import { link, text } from "../common"

const category = z.object({ label: text, description: text })

export const DEFAULT_CLOSE_LABEL = "Close"

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
  /**
   * Accessible name of the reopened banner's × button (spec §5.2). The
   * default fills values stored before the field existed (no migration).
   */
  closeLabel: text.default(DEFAULT_CLOSE_LABEL),
  policyLink: link,
  categories: z.object({
    necessary: category,
    analytics: category,
    marketing: category,
  }),
})
export type ConsentSettings = z.infer<typeof consentSettings>
