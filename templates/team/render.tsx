import { Team } from "@/components/home/clients-team-blog"
import { IconCards } from "@/components/home/icon-cards"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { SiteLocale } from "@/components/site-locale"

import type { TeamView } from "./view"

/** "/team" */
export function TeamTemplate({ view }: { view: TeamView }) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <PageHero {...view.hero} />
        <Team {...view.team} />
        <IconCards {...view.officers} />
        <EnquireBanner {...view.enquireBanner} />
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}
