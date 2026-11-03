import { Departments } from "@/components/contact/departments"
import { Contact, LocationMap } from "@/components/home/contact"
import { PageHero } from "@/components/home/page-hero"
import { HomeMotion } from "@/components/motion/home-motion"

import type { ContactView } from "./view"

/** "/contact" */
export function ContactTemplate({ view }: { view: ContactView }) {
  return (
    <>
      <main>
        <PageHero {...view.hero} />
        <Contact {...view.contact} />
        <Departments {...view.departments} />
        <LocationMap {...view.map} />
      </main>
      <HomeMotion />
    </>
  )
}
