import { z } from "zod"

import { paragraphsText } from "@/lib/schemas/common"

/** Icons a "What we offer" line can carry (components/careers/offer-icon.tsx). */
export const OFFER_ICONS = [
  "euro",
  "shield",
  "shirt",
  "clock",
  "wallet",
  "heart",
  "graduation",
  "car",
  "phone",
  "moon",
] as const
export type OfferIcon = (typeof OFFER_ICONS)[number]

/** schema.org employmentType of the job (JSON-LD); the wording shown is `employmentType`. */
export const CONTRACT_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "temporary",
] as const

const short = (max: number) => z.string().trim().min(1, "Required").max(max)
const list = (min: number, max: number) => z.array(short(300)).min(min).max(max)

/** A job opening's content (draft/published of `jobs`). */
export const jobContent = z.object({
  title: short(120),
  /** Category chip and tag, e.g. "Static Guarding". */
  category: short(60),
  /** PSA licence type the role needs (the listing's licence filter). */
  licence: short(80),
  location: short(120),
  /** Shown as is, e.g. "Full-time, Permanent". */
  employmentType: short(80),
  contractType: z.enum(CONTRACT_TYPES),
  shift: short(120),
  pay: short(80),
  reference: short(40),
  /** Free text, e.g. "December 2026". */
  startDate: short(60),
  /** YYYY-MM-DD; the role closes at the end of this day in Europe/Dublin. */
  closingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker (YYYY-MM-DD)"),
  urgent: z.boolean(),
  filled: z.boolean(),
  /** One sentence under the title in the hero. */
  summary: short(300),
  about: paragraphsText,
  responsibilities: list(1, 20),
  essential: list(1, 20),
  desirable: list(0, 20),
  offerIntro: z.string().max(300),
  offers: z
    .array(z.object({ icon: z.enum(OFFER_ICONS), text: short(120) }))
    .max(12),
})
export type JobContent = z.infer<typeof jobContent>
