import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { services } from "@/components/home/data"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { OtherServices } from "@/components/services/other-services"
import { ServiceBody } from "@/components/services/service-body"

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }))
}

const findService = (slug: string) =>
  services.find((service) => service.slug === slug)

export async function generateMetadata({
  params,
}: PageProps<"/services/[slug]">): Promise<Metadata> {
  const service = findService((await params).slug)
  if (!service) return {}
  return {
    title: `${service.title} | Security Partners Ltd.`,
    description: service.detail.intro,
  }
}

export default async function ServiceDetailPage({
  params,
}: PageProps<"/services/[slug]">) {
  const service = findService((await params).slug)
  if (!service) notFound()

  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          image="/images/hero.jpg"
          trail={[{ label: "Services", href: "/services" }]}
          crumb={service.title}
          title={service.title}
          description={service.detail.intro}
        />
        <ServiceBody service={service} />
        <OtherServices slug={service.slug} />
        <EnquireBanner />
      </main>
      <SiteFooter />
      <HomeMotion />
    </>
  )
}
