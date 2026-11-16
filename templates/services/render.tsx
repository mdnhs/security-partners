import { Fragment, type ReactNode } from "react"

import { Clients } from "@/components/home/clients-team-blog"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner, Services } from "@/components/home/services"
import { HomeMotion } from "@/components/motion/home-motion"
import { OtherServices } from "@/components/services/other-services"
import { ServiceBody } from "@/components/services/service-body"
import { WhyChooseUs } from "@/components/services/why-choose-us"

import type { ServiceDetailView, ServicesView } from "./view"

/** "/services" */
export function ServicesTemplate({ view }: { view: ServicesView }) {
  const parts: Record<ServicesView["sections"][number], ReactNode> = {
    services: <Services {...view.services} />,
    whyChooseUs: <WhyChooseUs {...view.whyChooseUs} />,
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

/** "/services/[slug]" */
export function ServiceDetailTemplate({ view }: { view: ServiceDetailView }) {
  return (
    <>
      <main>
        <PageHero {...view.hero} />
        <ServiceBody {...view.body} />
        <OtherServices {...view.others} />
        <EnquireBanner {...view.enquireBanner} />
      </main>
      <HomeMotion />
    </>
  )
}
