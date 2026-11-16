import { Fragment, type ReactNode } from "react"

import { Departments } from "@/components/contact/departments"
import { Contact, LocationMap } from "@/components/home/contact"
import { PageHero } from "@/components/home/page-hero"
import { HomeMotion } from "@/components/motion/home-motion"

import type { ContactView } from "./view"

/** "/contact" */
export function ContactTemplate({ view }: { view: ContactView }) {
  const parts: Record<ContactView["sections"][number], ReactNode> = {
    contact: <Contact {...view.contact} />,
    departments: <Departments {...view.departments} />,
    map: <LocationMap {...view.map} />,
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
