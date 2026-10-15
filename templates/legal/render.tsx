import { PageHero } from "@/components/home/page-hero"
import { Container } from "@/components/home/section"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { SiteLocale } from "@/components/site-locale"
import { ArticleBlocks } from "@/lib/rich-text/render"

import type { LegalView } from "./view"

/**
 * "/privacy" and "/terms" (spec §1.4 exception): the existing PageHero and
 * the article body styles, in a single readable column.
 */
export function LegalTemplate({ view }: { view: LegalView }) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <PageHero {...view.hero} />
        <section className="bg-white px-6 pt-14 pb-20 md:px-10 lg:pt-20 lg:pb-28">
          <Container>
            <article className="mx-auto flex max-w-[820px] min-w-0 flex-col gap-[22px]">
              <ArticleBlocks doc={view.body} />
            </article>
          </Container>
        </section>
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}
