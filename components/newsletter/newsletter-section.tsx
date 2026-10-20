import "server-only"

import { unstable_rethrow } from "next/navigation"
import { connection } from "next/server"

import { type NewsletterWhere, shouldRender } from "@/lib/newsletter/placement"
import { toPublicCopy } from "@/lib/schemas/settings/newsletter"
import { readPublishedSettings } from "@/server/modules/settings/service"

import { NewsletterForm } from "./newsletter-form"

/**
 * The signup form at one placement, from the published settings.newsletter.
 * Ruling 2: seeded "off", so /blog and /blog/<slug> render nothing extra.
 * Any failure renders nothing too: the form is never worth breaking a page.
 */
export async function NewsletterSection({ where }: { where: NewsletterWhere }) {
  await connection()
  const settings = await readPublishedSettings("newsletter").catch(
    (error: unknown) => {
      unstable_rethrow(error)
      console.error(
        `[newsletter] section not rendered (${error instanceof Error ? error.name : "unknown"})`
      )
      return null
    }
  )
  if (!settings || !shouldRender(settings.placement, where)) return null
  return <NewsletterForm id="newsletter" copy={toPublicCopy(settings)} />
}
