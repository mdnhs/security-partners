import type { Metadata } from "next"

import { values } from "@/components/about/data"
import { Stats } from "@/components/about/stats"
import { About } from "@/components/home/about"
import { Clients } from "@/components/home/clients-team-blog"
import { IconCards } from "@/components/home/icon-cards"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"

export const metadata: Metadata = {
  title: "About Us | Security Partners Ltd.",
  description:
    "A family-run security company based in Mountmellick, Co. Laois, providing first class security services across Ireland since 2008.",
}

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          image="/images/hero.jpg"
          crumb="About Us"
          title="About Security Partners"
          description="A family-run security company based in Mountmellick, Co. Laois, providing first class security services across Ireland since 2008."
        />
        <About />
        <Stats />
        <IconCards
          eyebrow="Our values"
          title="What We Stand For"
          description="Security Partners Ltd has an excellent reputation for providing a proactive, flexible and quality service that is completely customer focused."
          items={values}
        />
        <Clients />
        <EnquireBanner />
      </main>
      <SiteFooter />
      <HomeMotion />
    </>
  )
}
