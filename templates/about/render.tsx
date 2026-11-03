import { Stats } from "@/components/about/stats"
import { About } from "@/components/home/about"
import { Clients } from "@/components/home/clients-team-blog"
import { IconCards } from "@/components/home/icon-cards"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner } from "@/components/home/services"
import { HomeMotion } from "@/components/motion/home-motion"

import type { AboutView } from "./view"

/** "/about" */
export function AboutTemplate({ view }: { view: AboutView }) {
  return (
    <>
      <main>
        <PageHero {...view.hero} />
        <About {...view.about} />
        <Stats {...view.stats} />
        <IconCards {...view.values} />
        <Clients {...view.clients} />
        <EnquireBanner {...view.enquireBanner} />
      </main>
      <HomeMotion />
    </>
  )
}
