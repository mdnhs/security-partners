import { Fragment, type ReactNode } from "react"

import { Team } from "@/components/home/clients-team-blog"
import { IconCards } from "@/components/home/icon-cards"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner } from "@/components/home/services"
import { HomeMotion } from "@/components/motion/home-motion"

import type { TeamView } from "./view"

/** "/team" */
export function TeamTemplate({ view }: { view: TeamView }) {
  const parts: Record<TeamView["sections"][number], ReactNode> = {
    team: <Team {...view.team} stack />,
    officers: <IconCards {...view.officers} />,
    enquireBanner: <EnquireBanner {...view.enquireBanner} />,
  }
  return (
    <>
      <main>
        <PageHero {...view.hero} />
        {view.sections.map((id) => (
          <Fragment key={id}>{parts[id]}</Fragment>
        ))}
      </main>
      <HomeMotion />
    </>
  )
}
