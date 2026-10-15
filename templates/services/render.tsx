import { Clients } from "@/components/home/clients-team-blog"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner, Services } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { OtherServices } from "@/components/services/other-services"
import { ServiceBody } from "@/components/services/service-body"
import { WhyChooseUs } from "@/components/services/why-choose-us"
import { SiteLocale } from "@/components/site-locale"

import type { ServiceDetailView, ServicesView } from "./view"

/** "/services" */
export function ServicesTemplate({ view }: { view: ServicesView }) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <PageHero {...view.hero} />
        <Services {...view.services} />
        <WhyChooseUs {...view.whyChooseUs} />
        <Clients {...view.clients} />
        <EnquireBanner {...view.enquireBanner} />
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}

/** "/services/[slug]" */
export function ServiceDetailTemplate({ view }: { view: ServiceDetailView }) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <PageHero {...view.hero} />
        <ServiceBody {...view.body} />
        <OtherServices {...view.others} />
        <EnquireBanner {...view.enquireBanner} />
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}
