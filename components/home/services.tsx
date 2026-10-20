import Image from "next/image"
import Link from "next/link"

import { buttonClassName } from "@/components/ui/button"
import { Container, Eyebrow, SectionHeading } from "@/components/home/section"
import { interpolate } from "@/lib/interpolate"

export type ServiceCardData = {
  slug: string
  title: string
  description: string
  icon: string
}

/** "Read More" and the aria-label template "Read more about {title}". */
export type ServiceCardLabels = { readMore: string; ariaReadMore: string }

export type ServicesProps = {
  eyebrow: string
  title: string
  description: string
  services: ServiceCardData[]
  labels: ServiceCardLabels
}

export function Services({
  eyebrow,
  title,
  description,
  services,
  labels,
}: ServicesProps) {
  return (
    <section
      id="services"
      className="scroll-mt-28 bg-white px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
        />

        <ul
          data-stagger
          className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {services.map((service) => (
            <ServiceCard key={service.slug} service={service} labels={labels} />
          ))}
        </ul>
      </Container>
    </section>
  )
}

export function ServiceCard({
  service,
  labels,
}: {
  service: ServiceCardData
  labels: ServiceCardLabels
}) {
  return (
    <li className="flex flex-col items-start gap-4 rounded-3xl border border-brand-line bg-white px-8 py-9 shadow-[0px_10px_30px_0px_rgba(13,26,51,0.06)]">
      <div
        data-service-icon
        className="flex size-[88px] items-center justify-center overflow-hidden rounded-[20px] bg-brand-mint"
      >
        <div className="relative size-[120px] shrink-0">
          <Image
            src={service.icon}
            alt=""
            fill
            sizes="120px"
            className="object-contain"
          />
        </div>
      </div>
      <h3 className="text-[22px] leading-[normal] font-black text-brand-navy">
        {service.title}
      </h3>
      <p className="text-base leading-[1.6] text-brand-ink">
        {service.description}
      </p>
      <Link
        href={`/services/${service.slug}`}
        className="flex items-center gap-2 text-[15px] leading-[normal] font-bold text-brand-blue hover:underline"
        aria-label={interpolate(labels.ariaReadMore, { title: service.title })}
      >
        {`${labels.readMore} `}
        <span aria-hidden>→</span>
      </Link>
    </li>
  )
}

type BannerLink = { label: string; href: string }

export type EnquireBannerProps = {
  image: string
  eyebrow: string
  heading: string
  copy: string
  cta: BannerLink
  /** Label as text parts (lib/interpolate interpolateParts). */
  secondaryCta: { label: string[]; href: string }
}

export function EnquireBanner({
  image,
  eyebrow,
  heading,
  copy,
  cta,
  secondaryCta,
}: EnquireBannerProps) {
  return (
    <section className="bg-white px-6 py-20 md:px-10 lg:py-28">
      <Container>
        <div
          data-banner
          className="relative flex flex-col items-center gap-6 overflow-hidden rounded-[32px] px-6 py-16 text-center md:p-20"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              data-parallax
              className="absolute inset-x-0 -top-[15%] h-[130%] will-change-transform"
            >
              <Image
                src={image}
                alt=""
                fill
                sizes="(min-width: 1280px) 1200px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-linear-to-r from-brand-blue/95 to-brand-blue-deep/85" />
          </div>
          <Eyebrow data-banner-item className="relative">
            {eyebrow}
          </Eyebrow>
          <h2
            data-banner-item
            className="relative text-4xl font-black tracking-[-0.01em] text-white md:text-5xl"
          >
            {heading}
          </h2>
          <p
            data-banner-item
            className="relative max-w-[620px] text-lg leading-[1.6] text-white/85"
          >
            {copy}
          </p>
          <div
            data-banner-item
            className="relative flex flex-wrap justify-center gap-4 pt-2"
          >
            <Link
              href={cta.href}
              className={buttonClassName({ variant: "brand", size: "pill" })}
            >
              {cta.label}
            </Link>
            <a
              href={secondaryCta.href}
              className={buttonClassName({
                variant: "brand-outline",
                size: "pill",
              })}
            >
              {secondaryCta.label}
            </a>
          </div>
        </div>
      </Container>
    </section>
  )
}
