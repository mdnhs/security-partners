import { z } from "zod"

import { listQuery } from "./list"

/** Same values as the newsletter_status check (server/db/schema/newsletter.ts). */
export const NEWSLETTER_STATUSES = [
  "pending",
  "confirmed",
  "unsubscribed",
] as const
export type NewsletterStatus = (typeof NEWSLETTER_STATUSES)[number]

export const NEWSLETTER_ENDPOINT = "/api/v1/public/newsletter"

/**
 * POST /api/v1/public/newsletter. The address is trimmed and lower-cased
 * before validation, so " Ann@Example.IE " and "ann@example.ie" are one
 * subscriber. `website` is the honeypot (any value is accepted here; the
 * service drops filled ones silently).
 */
export const newsletterSubmission = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
  website: z.unknown().optional(),
  sourcePath: z
    .string()
    .max(300)
    .regex(/^\/(?![\/\\])[^\s\\]*$/, "Must be a path on this site")
    .optional(),
  turnstileToken: z.string().max(2048).optional(),
})
export type NewsletterSubmission = z.infer<typeof newsletterSubmission>

export const subscriberListQuery = listQuery.extend({
  status: z.enum(NEWSLETTER_STATUSES).optional(),
})
export type SubscriberListQuery = z.infer<typeof subscriberListQuery>

export const subscriberExportQuery = z.object({
  status: z.enum(["all", "confirmed"]).default("confirmed"),
})
export type SubscriberExportQuery = z.infer<typeof subscriberExportQuery>

/**
 * POST /api/v1/admin/newsletter/lookup and /erase (the lead page's privacy
 * helper). In the body, not the query, so the address stays out of URLs.
 */
export const subscriberEmailBody = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
})
export type SubscriberEmailBody = z.infer<typeof subscriberEmailBody>

export type SubscriberLookup = { subscriber: SubscriberDto | null }
export type SubscriberErasure = { erased: number }

export type SubscriberDto = {
  id: string
  email: string
  status: NewsletterStatus
  sourcePath: string
  createdAt: string
  confirmedAt: string | null
  unsubscribedAt: string | null
}

export const SUBSCRIBER_CSV_HEADER = [
  "Email",
  "Status",
  "Source",
  "Consent text",
  "Signed up",
  "Confirmed",
  "Unsubscribed",
] as const
