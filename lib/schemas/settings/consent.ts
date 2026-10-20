import { z } from "zod"

import { link, text } from "../common"

const category = z.object({ label: text, description: text })

export const DEFAULT_CLOSE_LABEL = "Close"
export const DEFAULT_CONSENT_VERSION = 1
export const DEFAULT_RECONSENT_MONTHS = 6

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
  /**
   * Raising it asks every visitor again: a choice stored under another
   * version counts as no choice. The defaults (also backfilled by the
   * 0015_marketing migration) keep a value stored before D2.2 valid.
   */
  version: z.number().int().min(1).default(DEFAULT_CONSENT_VERSION),
  /** How long a choice is kept before the banner asks again (30-day months). */
  reconsentMonths: z
    .number()
    .int()
    .min(1)
    .max(6)
    .default(DEFAULT_RECONSENT_MONTHS),
})
export type ConsentSettings = z.infer<typeof consentSettings>
