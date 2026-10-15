import type { Metadata } from "next"

import { Team } from "@/components/home/clients-team-blog"
import { IconCards } from "@/components/home/icon-cards"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { officerQualities } from "@/components/team/data"

export const metadata: Metadata = {
  title: "Our Team | Security Partners Ltd.",
  description:
    "The experienced people behind Security Partners, from operations to HR and accounts.",
}

export default function TeamPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          image="/images/hero.jpg"
          crumb="Our Team"
          title="Meet The Team"
          description="The experienced people behind Security Partners, from operations to HR and accounts."
        />
        <Team
          title="Leadership & Management"
          description="Contact the right person directly for your query."
        />
        <IconCards
          eyebrow="On the ground"
          title="Our Officers"
          description="Behind our management team is a team of licensed, uniformed officers working across Ireland."
          items={officerQualities}
          className="bg-brand-surface"
        />
        <EnquireBanner />
      </main>
      <SiteFooter />
      <HomeMotion />
    </>
  )
}
