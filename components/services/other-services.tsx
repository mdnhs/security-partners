import { ChevronRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import { Container, SectionHeading } from "@/components/home/section"
import {
  ServiceCard,
  type ServiceCardData,
  type ServiceCardLabels,
} from "@/components/home/services"

export type OtherServicesProps = {
  eyebrow: string
  heading: string
  intro: string
  /** The next three services after the current one, wrapping around. */
  services: ServiceCardData[]
  labels: ServiceCardLabels
}

export function OtherServices({
  eyebrow,
  heading,
  intro,
  services,
  labels,
}: OtherServicesProps) {
  return (
    <section className="bg-brand-surface px-5 py-14 md:px-10 md:py-20 lg:py-28">
      <Container className="flex flex-col gap-6 md:gap-14">
        <SectionHeading eyebrow={eyebrow} title={heading} description={intro} />
        <ul className="flex flex-col gap-3 md:hidden">
          {services.map((service) => (
            <li key={service.slug}>
              <Link
                href={`/services/${service.slug}`}
                className="flex items-center gap-3.5 rounded-[18px] border border-brand-line bg-white p-3.5"
              >
                <span
                  aria-hidden
                  className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-brand-mint"
                >
                  <span className="relative size-[76px] shrink-0">
                    <Image
                      src={service.icon}
                      alt=""
                      fill
                      sizes="76px"
                      className="object-contain"
                    />
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-base leading-[21px] font-black text-brand-navy">
                    {service.title}
                  </span>
                  <span className="text-sm leading-5 text-brand-ink">
                    {service.description}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-surface text-brand-blue"
                >
                  <ChevronRight className="size-[18px]" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/services"
          className="flex h-[52px] w-full items-center justify-center rounded-full border-[1.5px] border-brand-blue bg-white px-6 text-base font-bold text-brand-blue md:hidden"
        >
          View All Services
        </Link>
        <ul
          data-stagger
          className="grid gap-6 max-md:hidden sm:grid-cols-2 lg:grid-cols-3"
        >
          {services.map((service) => (
            <ServiceCard key={service.slug} service={service} labels={labels} />
          ))}
        </ul>
      </Container>
    </section>
  )
}
