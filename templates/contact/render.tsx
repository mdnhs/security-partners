import { Departments } from "@/components/contact/departments"
import { Contact, LocationMap } from "@/components/home/contact"
import { PageHero } from "@/components/home/page-hero"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { SiteLocale } from "@/components/site-locale"

import type { ContactView } from "./view"

/** "/contact" */
export function ContactTemplate({ view }: { view: ContactView }) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <PageHero {...view.hero} />
        <Contact {...view.contact} />
        <Departments {...view.departments} />
        <LocationMap {...view.map} />
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}
