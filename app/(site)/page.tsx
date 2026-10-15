import { About } from "@/components/home/about"
import { Blog, Clients, Team } from "@/components/home/clients-team-blog"
import { Contact, LocationMap } from "@/components/home/contact"
import { Hero } from "@/components/home/hero"
import { HomeMotion } from "@/components/motion/home-motion"
import { EnquireBanner, Services } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <About />
        <Services />
        <EnquireBanner />
        <Clients />
        <Team />
        <Blog />
        <Contact />
        <LocationMap />
      </main>
      <SiteFooter />
      <HomeMotion />
    </>
  )
}
