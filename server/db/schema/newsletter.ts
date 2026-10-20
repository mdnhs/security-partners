import "server-only"

import { sql } from "drizzle-orm"
import { check, index, pgTable, text } from "drizzle-orm/pg-core"

import {
  NEWSLETTER_STATUSES,
  type NewsletterStatus,
} from "@/lib/schemas/api/newsletter"

import { id, timestamps, tsz } from "./_shared"

export { NEWSLETTER_STATUSES }

/** Spec §7.4. Double opt-in subscribers; only a sha256 of the confirm token is stored. */
export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: id(),
    email: text("email").notNull().unique(),
    status: text("status").$type<NewsletterStatus>().notNull(),
    tokenHash: text("token_hash").unique(),
    tokenExpiresAt: tsz("token_expires_at"),
    sourcePath: text("source_path").notNull().default("/"),
    /** Form copy the visitor agreed to (proof of consent). */
    consentText: text("consent_text").notNull().default(""),
    confirmedAt: tsz("confirmed_at"),
    /** Kept as history when the address subscribes again. */
    unsubscribedAt: tsz("unsubscribed_at"),
    /** HMAC of the client IP (HKDF purpose "lead-ip"), never the raw IP. */
    ipHash: text("ip_hash"),
    ...timestamps(),
  },
  (t) => [
    check("newsletter_email_lower", sql`${t.email} = lower(${t.email})`),
    check(
      "newsletter_status",
      sql`${t.status} in ('pending', 'confirmed', 'unsubscribed')`
    ),
    index("newsletter_subscribers_status_created_at_idx").on(
      t.status,
      t.createdAt
    ),
  ]
)
