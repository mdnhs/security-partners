import { Fragment, type ReactNode } from "react"

import { About } from "@/components/home/about"
import { Blog, Clients, Team } from "@/components/home/clients-team-blog"
import { Contact, LocationMap } from "@/components/home/contact"
import { Hero } from "@/components/home/hero"
import { EnquireBanner, Services } from "@/components/home/services"
import { HomeMotion } from "@/components/motion/home-motion"

import type { HomeView } from "./view"

/** "/" — section order is the design's; content comes from the view. */
export function HomeTemplate({ view }: { view: HomeView }) {
  const parts: Record<HomeView["sections"][number], ReactNode> = {
    about: <About {...view.about} />,
    services: <Services {...view.services} />,
    enquireBanner: <EnquireBanner {...view.enquireBanner} />,
    clients: <Clients {...view.clients} />,
    team: <Team {...view.team} />,
    blog: <Blog {...view.blog} />,
    contact: <Contact {...view.contact} />,
    map: <LocationMap {...view.map} />,
  }
  return (
    <>
      <main>
        <Hero {...view.hero} />
        {view.sections.map((id) => (
          <Fragment key={id}>{parts[id]}</Fragment>
        ))}
      </main>
      <HomeMotion />
    </>
  )
}
