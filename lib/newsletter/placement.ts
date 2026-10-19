import type { NewsletterPlacement } from "@/lib/schemas/settings/newsletter"

/** Where a NewsletterSection sits; "off" is never one of them. */
export type NewsletterWhere = Exclude<NewsletterPlacement, "off">

/** Ruling 2: the form renders only at the placement an admin chose ("off" renders nothing). */
export function shouldRender(
  placement: NewsletterPlacement,
  where: NewsletterWhere
): boolean {
  return placement !== "off" && placement === where
}

/** /newsletter/[state]: the pages the public API redirects to (plus the unsubscribe button page). */
export const NEWSLETTER_STATES = [
  "confirmed",
  "invalid",
  "unsubscribe",
  "unsubscribed",
] as const
export type NewsletterState = (typeof NEWSLETTER_STATES)[number]

export function isNewsletterState(value: string): value is NewsletterState {
  return (NEWSLETTER_STATES as readonly string[]).includes(value)
}

/** The public API's unsubscribe endpoint (POST only; the state page's form posts here). */
export const NEWSLETTER_UNSUBSCRIBE_ENDPOINT =
  "/api/v1/public/newsletter/unsubscribe"
