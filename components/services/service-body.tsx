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
    <section className="bg-white px-6 py-20 md:px-10 lg:py-28">
      <Container className="flex flex-col gap-12 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div
            data-reveal
            className="relative h-72 overflow-hidden rounded-[28px] md:h-[440px]"
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

          <div data-stagger className="mt-8 flex flex-col gap-3.5">
            <Eyebrow>{labels.overviewEyebrow}</Eyebrow>
            <h2 className="text-3xl leading-[1.15] font-black tracking-[-0.01em] text-brand-navy md:text-[40px]">
              {heading}
            </h2>
          </div>
          {overview.content.map((paragraph, i) => (
            <p key={i} className="text-lg leading-[1.7] text-brand-ink">
              {renderInline(paragraph.content)}
            </p>
          ))}

          <h3 className="text-[26px] leading-[normal] font-black text-brand-navy">
            {labels.includedHeading}
          </h3>
          <ul data-stagger className="flex flex-col gap-3.5">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-3.5">
                <Image
                  src="/images/check.svg"
                  alt=""
                  width={24}
                  height={24}
                  className="shrink-0"
                />
                <span className="text-base leading-normal font-medium text-brand-navy">
                  {item}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-5 rounded-3xl bg-brand-mint px-6 py-7 md:px-8">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-green">
              <Image
                src="/images/icon-phone.svg"
                alt=""
                width={24}
                height={24}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1 leading-[normal]">
              <p className="text-base leading-[normal] font-bold text-brand-navy">
                {callout}
              </p>
              <a
                href={phone24hHref}
                className="text-[28px] font-black text-brand-blue hover:underline"
              >
                {phone24h}
              </a>
            </div>
          </div>
        </div>

        <aside className="flex w-full flex-col gap-6 lg:w-[392px] lg:shrink-0">
          <nav
            aria-label={labels.allServicesAria}
            className="flex flex-col gap-2.5 rounded-3xl border border-brand-line bg-white px-6 py-7 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)]"
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

          <div className="flex flex-col items-start gap-3.5 rounded-3xl bg-brand-blue px-8 py-9">
            <Eyebrow>{labels.helpEyebrow}</Eyebrow>
            <p className="text-[26px] leading-[1.2] font-black text-white">
              {labels.helpHeading}
            </p>
            <div className="text-[15px] leading-[1.65] text-white/85">
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
            <p className="text-sm leading-[normal] font-bold text-white/70">
              {labels.phone24hLabel}
            </p>
            <a
              href={phone24hHref}
              className="text-[28px] leading-[normal] font-black text-white"
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
          </div>
        </aside>
      </Container>
    </section>
  )
}
