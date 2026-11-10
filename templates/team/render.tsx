import { Team } from "@/components/home/clients-team-blog"
import { IconCards } from "@/components/home/icon-cards"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner } from "@/components/home/services"
import { HomeMotion } from "@/components/motion/home-motion"

import type { TeamView } from "./view"

/** "/team" */
export function TeamTemplate({ view }: { view: TeamView }) {
  return (
    <>
      <main>
        <PageHero {...view.hero} />
        <Team {...view.team} stack />
        <IconCards {...view.officers} />
        <EnquireBanner {...view.enquireBanner} />
      </main>
      <HomeMotion />
    </>
  )
}
