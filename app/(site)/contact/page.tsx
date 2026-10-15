import type { Metadata } from "next"

import { Departments } from "@/components/contact/departments"
import { Contact, LocationMap } from "@/components/home/contact"
import { contact } from "@/components/home/data"
import { PageHero } from "@/components/home/page-hero"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"

export const metadata: Metadata = {
  title: "Contact Us | Security Partners Ltd.",
  description: `Get in touch with our team. For urgent matters, our 24 Hour Number is ${contact.phone24h}.`,
}

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          image="/images/hero.jpg"
          crumb="Contact"
          wideDescription
          title="Contact Us"
          description={`Get in touch with our team. For urgent matters, our 24 Hour Number is ${contact.phone24h}.`}
        />
        <Contact />
        <Departments />
        <LocationMap />
      </main>
      <SiteFooter />
      <HomeMotion />
    </>
  )
}
