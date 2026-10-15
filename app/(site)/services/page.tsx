import type { Metadata } from "next"

import { Clients } from "@/components/home/clients-team-blog"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner, Services } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { WhyChooseUs } from "@/components/services/why-choose-us"

export const metadata: Metadata = {
  title: "Our Services | Security Partners Ltd.",
  description:
    "Professional security solutions for every sector, from a single alarm response to full-time static guarding.",
}

export default function ServicesPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          image="/images/banner.png"
          crumb="Services"
          title="Our Services"
          description="Professional security solutions for every sector, from a single alarm response to full-time static guarding."
        />
        <Services
          title="Security For Every Sector"
          description="Six specialist services, all backed by our dedicated 24/7 Operations Team."
        />
        <WhyChooseUs />
        <Clients />
        <EnquireBanner />
      </main>
      <SiteFooter />
      <HomeMotion />
    </>
  )
}
