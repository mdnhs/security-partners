import { PageHero } from "@/components/home/page-hero"
import { Container } from "@/components/home/section"
import { HomeMotion } from "@/components/motion/home-motion"
import { ArticleBlocks } from "@/lib/rich-text/render"

import type { LegalView } from "./view"

/**
 * "/privacy" and "/terms" (spec §1.4 exception): the existing PageHero and
 * the article body styles, in a single readable column.
 */
export function LegalTemplate({ view }: { view: LegalView }) {
  return (
    <>
      <main>
        <PageHero {...view.hero} />
        <section className="bg-white px-5 pt-8 pb-14 md:px-10 md:pt-14 md:pb-20 lg:pt-20 lg:pb-28">
          <Container>
            <article className="mx-auto flex max-w-[820px] min-w-0 flex-col gap-[18px] md:gap-[22px]">
              {view.updated ? (
                <p className="text-sm font-bold text-brand-muted">
                  Last updated{" "}
                  <time dateTime={view.updated.iso}>{view.updated.label}</time>
                </p>
              ) : null}
              <ArticleBlocks doc={view.body} />
            </article>
          </Container>
        </section>
      </main>
      <HomeMotion />
    </>
  )
}
