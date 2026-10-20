import { Stats } from "@/components/about/stats"
import { Departments } from "@/components/contact/departments"
import { About } from "@/components/home/about"
import { Blog, Clients, Team } from "@/components/home/clients-team-blog"
import { Contact, LocationMap } from "@/components/home/contact"
import { IconCards } from "@/components/home/icon-cards"
import { PageHero } from "@/components/home/page-hero"
import { Container } from "@/components/home/section"
import { EnquireBanner, Services } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { WhyChooseUs } from "@/components/services/why-choose-us"
import { SiteLocale } from "@/components/site-locale"
import { ArticleBlocks } from "@/lib/rich-text/render"
import type { ChromeView } from "@/templates/shared/views"

import type { BlockViewResult, BuilderBlockView } from "./views"

/**
 * The id each existing section renders itself (components are frozen and
 * take no id prop). A block whose anchor is that id needs no wrapper.
 */
const OWN_ID: Partial<Record<BlockViewResult["type"], string>> = {
  about: "about",
  services: "services",
  team: "team",
  blog: "blog",
  contact: "contact",
}

function Section({ view }: { view: BlockViewResult }) {
  switch (view.type) {
    case "hero.page":
      return <PageHero {...view.props} />
    case "about":
      return <About {...view.props} />
    case "stats":
      return <Stats {...view.props} />
    case "iconCards":
      return <IconCards {...view.props} />
    case "services":
      return <Services {...view.props} />
    case "whyChooseUs":
      return <WhyChooseUs {...view.props} />
    case "enquireBanner":
      return <EnquireBanner {...view.props} />
    case "clients":
      return <Clients {...view.props} />
    case "team":
      return <Team {...view.props} />
    case "blog":
      return <Blog {...view.props} />
    case "departments":
      return <Departments {...view.props} />
    case "contact":
      return <Contact {...view.props} />
    case "map":
      return <LocationMap {...view.props} />
    case "richtext":
      // The legal pages' article body styles (spec §7.5).
      return (
        <section className="bg-white px-6 pt-14 pb-20 md:px-10 lg:pt-20 lg:pb-28">
          <Container>
            <article className="mx-auto flex max-w-[820px] min-w-0 flex-col gap-[22px]">
              <ArticleBlocks doc={view.props.doc} />
            </article>
          </Container>
        </section>
      )
  }
}

/** "/p/<slug>": the page's visible blocks, in order, inside the site chrome. */
export function BuilderTemplate({
  chrome,
  blocks,
}: {
  chrome: ChromeView
  blocks: BuilderBlockView[]
}) {
  return (
    <>
      <SiteHeader {...chrome.header} />
      <main>
        {/* builderBlocksView already left hidden blocks out. */}
        {blocks.map(({ block, view }) =>
          OWN_ID[view.type] === block.anchor ? (
            <Section key={block.id} view={view} />
          ) : (
            <div key={block.id} id={block.anchor}>
              <Section view={view} />
            </div>
          )
        )}
      </main>
      <SiteFooter {...chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={chrome.locale} />
    </>
  )
}
