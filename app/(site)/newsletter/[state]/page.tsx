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
import { isNewsletterState } from "@/lib/newsletter/placement"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { readPublishedSettings } from "@/server/modules/settings/service"
import { chromeView, pageHeroView } from "@/templates/shared/views"

/** Tokens carry no secret beyond themselves; never leak them via Referer or an index. */
const PRIVATE: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

/** Longest token the page will echo into its form (`<uuid>.<32 chars>` is 69). */
const MAX_TOKEN = 200

export async function generateMetadata({
  params,
}: PageProps<"/newsletter/[state]">): Promise<Metadata> {
  await connection()
  const { state } = await params
  if (!isNewsletterState(state)) return PRIVATE
  try {
    const settings = await readPublishedSettings("newsletter")
    return settings
      ? { ...PRIVATE, title: settings.pages[state].title }
      : PRIVATE
  } catch {
    return PRIVATE
  }
}

/**
 * /newsletter/confirmed | invalid | unsubscribe | unsubscribed (D4.2): the
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
  if (!settings) notFound()
  const copy = settings.pages[state]
  const token =
    state === "unsubscribe" &&
    typeof query.token === "string" &&
    query.token.length <= MAX_TOKEN
      ? query.token
      : ""
  const chrome = chromeView(s)
  // The legal pages' hero image; title and crumb are this state's copy.
  const hero = pageHeroView(s, {
    ...s.pages.privacy.data.hero,
    crumb: copy.title,
    title: copy.title,
    description: "",
  })
  return (
    <>
      <SiteHeader {...chrome.header} />
      <main>
        <PageHero {...hero} />
        <section className="bg-white px-6 pt-14 pb-20 md:px-10 lg:pt-20 lg:pb-28">
          <Container>
            <NewsletterStateBody
              state={state}
              body={copy.body}
              button={"button" in copy ? copy.button : undefined}
              token={token}
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
