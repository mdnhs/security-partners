import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { PageHero } from "@/components/home/page-hero"
import { Container } from "@/components/home/section"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { NewsletterStateBody } from "@/components/newsletter/newsletter-state"
import { SiteLocale } from "@/components/site-locale"
import { isNewsletterState, newsletterView } from "@/lib/newsletter/placement"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { readPublishedSettings } from "@/server/modules/settings/service"
import { chromeView, pageHeroView } from "@/templates/shared/views"

/**
 * Tokens carry no secret beyond themselves; never leak them via Referer or
 * an index. next.config.ts also sends these as headers (plus no-store) for
 * every /newsletter path, and the page is dynamic (connection()), so a
 * token page is never prerendered or cached.
 */
const PRIVATE: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/newsletter/[state]">): Promise<Metadata> {
  await connection()
  const [{ state }, query] = await Promise.all([params, searchParams])
  if (!isNewsletterState(state)) return PRIVATE
  try {
    const settings = await readPublishedSettings("newsletter")
    return settings
      ? {
          ...PRIVATE,
          title: settings.pages[newsletterView(state, query.token).state].title,
        }
      : PRIVATE
  } catch {
    return PRIVATE
  }
}

/**
 * /newsletter/confirm | confirmed | invalid | unsubscribe | unsubscribed: the
 * legal pages' layout (PageHero + one reading column) with the copy from
 * settings.newsletter.pages. proxy.ts answers any other /newsletter path
 * with a real 404 before streaming (resolvePublicPath).
 */
export default function NewsletterStatePage({
  params,
  searchParams,
}: PageProps<"/newsletter/[state]">) {
  return (
    <Suspense fallback={null}>
      <NewsletterState params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function NewsletterState({
  params,
  searchParams,
}: Pick<PageProps<"/newsletter/[state]">, "params" | "searchParams">) {
  await connection()
  const [{ state }, query] = await Promise.all([params, searchParams])
  if (!isNewsletterState(state)) notFound()
  const [s, settings] = await Promise.all([
    loadSiteSources(),
    readPublishedSettings("newsletter"),
  ])
  // Unreachable with the seed (it publishes newsletter settings). Inside
  // Suspense this is a soft 404 (200 + not-found UI): the proxy has already
  // passed the path, and streaming has started.
  if (!settings) notFound()
  // The token is only echoed into the hidden form field: never into a link,
  // and analytics tags do not load on a token URL (TrackingScripts).
  const view = newsletterView(state, query.token)
  const copy = settings.pages[view.state]
  const chrome = chromeView(s)
  // The legal pages' hero image; title and crumb are this state's copy, and
  // there is no description paragraph.
  const hero = {
    ...pageHeroView(s, {
      ...s.pages.privacy.data.hero,
      crumb: copy.title,
      title: copy.title,
    }),
    description: undefined,
  }
  return (
    <>
      <SiteHeader {...chrome.header} />
      <main>
        <PageHero {...hero} />
        <section className="bg-white px-6 pt-14 pb-20 md:px-10 lg:pt-20 lg:pb-28">
          <Container>
            <NewsletterStateBody
              body={copy.body}
              button={"button" in copy ? copy.button : undefined}
              action={view.action}
              token={view.token}
            />
          </Container>
        </section>
      </main>
      <SiteFooter {...chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={chrome.locale} />
    </>
  )
}
