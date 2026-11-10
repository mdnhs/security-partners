import { Phone } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import { buttonClassName } from "@/components/ui/button"
import { Container, Eyebrow } from "@/components/home/section"
import { renderInline } from "@/lib/rich-text/render"
import type { ParagraphsDoc } from "@/lib/schemas/common"
import { cn } from "@/lib/utils"

export type ServiceBodyProps = {
  slug: string
  image: { src: string; alt: string }
  heading: string
  overview: ParagraphsDoc
  included: string[]
  callout: string
  phone24h: string
  phone24hHref: string
  allServices: { slug: string; title: string }[]
  operations: {
    office: string
    officeHref: string
    extension: string
    mobile: string
    mobileHref: string
    email: string
  }
  labels: {
    overviewEyebrow: string
    includedHeading: string
    allServicesAria: string
    allServicesHeading: string
    helpEyebrow: string
    helpHeading: string
    telLabel: string
    orLabel: string
    phone24hLabel: string
    cta: { label: string; href: string }
  }
}

export function ServiceBody({
  slug,
  image,
  heading,
  overview,
  included,
  callout,
  phone24h,
  phone24hHref,
  allServices,
  operations,
  labels,
}: ServiceBodyProps) {
  return (
    <section className="bg-white px-5 pt-0 pb-14 md:px-10 md:py-20 lg:py-28">
      {/* Phones: swipeable chips to jump between the services. */}
      <nav
        aria-label={labels.allServicesAria}
        className="-mx-5 mb-7 border-b border-brand-line bg-white md:hidden"
      >
        <ul className="flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 py-3.5 [&::-webkit-scrollbar]:hidden">
          {allServices.map((item) => {
            const active = item.slug === slug
            return (
              <li key={item.slug} className="shrink-0">
                <Link
                  href={`/services/${item.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center rounded-full border px-4 text-sm font-bold whitespace-nowrap",
                    active
                      ? "border-brand-blue bg-brand-blue text-white"
                      : "border-brand-line bg-white text-brand-navy"
                  )}
                >
                  {item.title}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <Container className="flex flex-col gap-5 md:gap-12 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5 md:gap-6">
          <div
            data-reveal
            className="relative h-[220px] overflow-hidden rounded-[20px] md:h-[440px] md:rounded-[28px]"
          >
            <div
              data-parallax
              className="absolute inset-x-0 -top-[8%] h-[116%] will-change-transform"
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(min-width: 1280px) 760px, 100vw"
                className="object-cover"
              />
            </div>
          </div>

          <div
            data-stagger
            className="flex flex-col gap-2.5 md:mt-8 md:gap-3.5"
          >
            <Eyebrow>{labels.overviewEyebrow}</Eyebrow>
            <h2 className="text-[26px] leading-8 font-black tracking-[-0.01em] text-brand-navy md:text-[40px] md:leading-[1.15]">
              {heading}
            </h2>
          </div>
          {overview.content.map((paragraph, i) => (
            <p
              key={i}
              className="text-base leading-[26px] text-brand-ink md:text-lg md:leading-[1.7]"
            >
              {renderInline(paragraph.content)}
            </p>
          ))}

          <h3 className="text-xl leading-[26px] font-black text-brand-navy md:text-[26px] md:leading-[normal]">
            {labels.includedHeading}
          </h3>
          <ul data-stagger className="flex flex-col gap-3 md:gap-3.5">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-3 md:gap-3.5">
                <Image
                  src="/images/check.svg"
                  alt=""
                  width={24}
                  height={24}
                  className="size-[22px] shrink-0 md:size-6"
                />
                <span className="text-base leading-6 font-medium text-brand-navy md:leading-normal">
                  {item}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3.5 rounded-[18px] bg-brand-mint p-[18px] md:gap-5 md:rounded-3xl md:px-8 md:py-7">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-green md:size-14 md:rounded-2xl">
              <Image
                src="/images/icon-phone.svg"
                alt=""
                width={24}
                height={24}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1 leading-[normal]">
              <p className="text-sm leading-5 font-bold text-brand-navy md:text-base md:leading-[normal]">
                {callout}
              </p>
              <a
                href={phone24hHref}
                className="text-2xl leading-[30px] font-black text-brand-blue hover:underline md:text-[28px] md:leading-[normal]"
              >
                {phone24h}
              </a>
            </div>
          </div>
        </div>

        <aside className="flex w-full flex-col gap-5 md:gap-6 lg:w-[392px] lg:shrink-0">
          <nav
            aria-label={labels.allServicesAria}
            className="flex flex-col gap-2.5 rounded-3xl border border-brand-line bg-white px-6 py-7 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)] max-md:hidden"
          >
            <p className="mb-3.5 text-xl leading-[normal] font-black text-brand-navy">
              {labels.allServicesHeading}
            </p>
            {allServices.map((item) => {
              const active = item.slug === slug
              return (
                <Link
                  key={item.slug}
                  href={`/services/${item.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-[14px] px-[18px] py-4 leading-[normal] font-bold transition-colors",
                    active
                      ? "bg-brand-blue text-white"
                      : "bg-brand-surface text-brand-navy hover:bg-brand-mint"
                  )}
                >
                  <span className="text-[15px]">{item.title}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "text-base leading-[normal]",
                      active ? "text-white" : "text-brand-blue"
                    )}
                  >
                    →
                  </span>
                </Link>
              )
            })}
          </nav>

          <div className="flex flex-col items-start gap-3 rounded-[20px] bg-brand-blue p-6 md:gap-3.5 md:rounded-3xl md:px-8 md:py-9">
            <Eyebrow>{labels.helpEyebrow}</Eyebrow>
            <p className="text-[22px] leading-7 font-black text-white md:text-[26px] md:leading-[1.2]">
              {labels.helpHeading}
            </p>
            <div className="text-[15px] leading-[23px] text-white/85 md:leading-[1.65]">
              <p>
                {labels.telLabel}{" "}
                <a href={operations.officeHref} className="hover:text-white">
                  {operations.office}
                  {` ${operations.extension}`}
                </a>{" "}
                {labels.orLabel}{" "}
                <a href={operations.mobileHref} className="hover:text-white">
                  {operations.mobile}
                </a>
              </p>
              <a
                href={`mailto:${operations.email}`}
                className="break-all hover:text-white"
              >
                {operations.email}
              </a>
            </div>
            <div className="h-px w-full bg-white/18" />
            <p className="w-full text-center text-sm leading-[normal] font-bold text-white/80 md:w-auto md:text-left md:text-white/70">
              {labels.phone24hLabel}
            </p>
            <a
              href={phone24hHref}
              className="w-full text-center text-[26px] leading-[normal] font-black text-white md:w-auto md:text-left md:text-[28px]"
            >
              {phone24h}
            </a>
            <Link
              href={labels.cta.href}
              className={buttonClassName(
                { variant: "brand", size: "pill" },
                "w-full"
              )}
            >
              {labels.cta.label}
            </Link>
            <a
              href={operations.officeHref}
              className={buttonClassName(
                { variant: "brand-outline", size: "pill" },
                "h-[52px] w-full gap-2 bg-white/8 py-0 md:hidden"
              )}
            >
              <Phone aria-hidden className="size-5" />
              Call Operations
            </a>
          </div>
        </aside>
      </Container>
    </section>
  )
}
