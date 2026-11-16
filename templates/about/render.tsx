import { Fragment, type ReactNode } from "react"

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
  const parts: Record<AboutView["sections"][number], ReactNode> = {
    about: <About {...view.about} />,
    stats: <Stats {...view.stats} />,
    values: <IconCards {...view.values} />,
    clients: <Clients {...view.clients} />,
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
