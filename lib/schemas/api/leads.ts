import { z } from "zod"

/** Same order as the DB enum lead_status (server/db/schema/leads.ts). */
export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
  "spam",
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  won: "Won",
  lost: "Lost",
  spam: "Spam",
}

/** Spec §8.1 "open leads" (dashboard KPI, inbox filter). */
export const OPEN_LEAD_STATUSES: readonly LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
]

export const LEAD_EVENT_TYPES = [
  "created",
  "status",
  "assigned",
  "note",
  "email",
] as const
export type LeadEventType = (typeof LEAD_EVENT_TYPES)[number]

export const LEADS_ENDPOINT = "/api/v1/public/leads"
export const LEADS_CONFIG_ENDPOINT = "/api/v1/public/leads/config"

/** C0 controls and DEL; `allow` keeps e.g. tab/newlines in the message. */
function hasControlChars(value: string, allow = ""): boolean {
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    if ((code < 32 || code === 127) && !allow.includes(ch)) return true
  }
  return false
}

/**
 * Line/paragraph separators (U+2028/2029) and bidi embeddings, overrides
 * and isolates (U+202A–202E, U+2066–2069): not allowed in one-line fields,
 * which end up in email subjects/headers and admin lists.
 */
const UNSAFE_IN_LINE = /[\u2028\u2029\u202A-\u202E\u2066-\u2069]/

const isSingleLine = (v: string) =>
  !hasControlChars(v) && !UNSAFE_IN_LINE.test(v)

const oneLine = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .refine(isSingleLine, "Use a single line of text")

const optionalLine = (max: number) =>
  oneLine(max)
    .default("")
    .transform((v) => (v ? v : null))

/** POST /api/v1/public/leads (contact form). Shared by the form and the API. */
export const leadSubmission = z.object({
  name: oneLine(200).pipe(z.string().min(1, "Enter your name")),
  email: z
    .string()
    .trim()
    .max(320, "Use at most 320 characters")
    .pipe(z.email("Enter a valid email address")),
  phone: optionalLine(50),
  company: optionalLine(200),
  service: optionalLine(200),
  message: z
    .string()
    .trim()
    .min(1, "Enter a message")
    .max(5000, "Keep the message under 5,000 characters")
    .refine((v) => !hasControlChars(v, "\t\n\r"), "Remove special characters"),
  /** The visitor sent the form so we can answer it (phase correction). */
  consent: z.boolean().default(false),
  sourcePage: z
    .string()
    .max(300)
    .regex(/^\/(?![\/\\])[^\s\\]*$/, "Must be a path on this site")
    .refine(isSingleLine, "Must be a path on this site")
    .optional(),
  /** Honeypot: hidden from people, filled by bots. Any type is accepted (and fires when non-empty). */
  website: z.unknown().optional(),
  turnstileToken: z.string().max(2048).optional(),
})
export type LeadSubmission = z.output<typeof leadSubmission>

export type LeadPublicConfig = { turnstileSiteKey: string | null }
