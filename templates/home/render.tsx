import { About } from "@/components/home/about"
import { Blog, Clients, Team } from "@/components/home/clients-team-blog"
import { Contact, LocationMap } from "@/components/home/contact"
import { Hero } from "@/components/home/hero"
import { EnquireBanner, Services } from "@/components/home/services"
import { HomeMotion } from "@/components/motion/home-motion"

import type { HomeView } from "./view"

/** "/" — section order is the design's; content comes from the view. */
export function HomeTemplate({ view }: { view: HomeView }) {
  return (
    <>
      <main>
        <Hero {...view.hero} />
        <About {...view.about} />
        <Services {...view.services} />
        <EnquireBanner {...view.enquireBanner} />
        <Clients {...view.clients} />
        <Team {...view.team} />
        <Blog {...view.blog} />
        <Contact {...view.contact} />
        <LocationMap {...view.map} />
      </main>
      <HomeMotion />
    </>
  )
}
