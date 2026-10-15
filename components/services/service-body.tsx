import Image from "next/image"
import Link from "next/link"

import { buttonClassName } from "@/components/ui/button"
import { Container, Eyebrow } from "@/components/home/section"
import { contact, services, type Service } from "@/components/home/data"
import { cn } from "@/lib/utils"

export function ServiceBody({ service }: { service: Service }) {
  const { detail } = service

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
                src="/images/about.png"
                alt="Security Partners officer at work"
                fill
                sizes="(min-width: 1280px) 760px, 100vw"
                className="object-cover"
              />
            </div>
          </div>

          <div data-stagger className="mt-8 flex flex-col gap-3.5">
            <Eyebrow>Service overview</Eyebrow>
            <h2 className="text-3xl leading-[1.15] font-black tracking-[-0.01em] text-brand-navy md:text-[40px]">
              {detail.heading}
            </h2>
          </div>
          <p className="text-lg leading-[1.7] text-brand-ink">
            {detail.overview}
          </p>

          <h3 className="text-[26px] leading-[normal] font-black text-brand-navy">
            What&apos;s included
          </h3>
          <ul data-stagger className="flex flex-col gap-3.5">
            {detail.included.map((item) => (
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
                {detail.callout}
              </p>
              <a
                href={contact.phone24hHref}
                className="text-[28px] font-black text-brand-blue hover:underline"
              >
                {contact.phone24h}
              </a>
            </div>
          </div>
        </div>

        <aside className="flex w-full flex-col gap-6 lg:w-[392px] lg:shrink-0">
          <nav
            aria-label="All services"
            className="flex flex-col gap-2.5 rounded-3xl border border-brand-line bg-white px-6 py-7 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)]"
          >
            <p className="mb-3.5 text-xl leading-[normal] font-black text-brand-navy">
              All Services
            </p>
            {services.map((item) => {
              const active = item.slug === service.slug
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
            <Eyebrow>Need help?</Eyebrow>
            <p className="text-[26px] leading-[1.2] font-black text-white">
              Talk to our Operations Team
            </p>
            <div className="text-[15px] leading-[1.65] text-white/85">
              <p>
                Tel:{" "}
                <a href={contact.officeHref} className="hover:text-white">
                  {contact.office} Ext 2
                </a>{" "}
                or{" "}
                <a
                  href={contact.operationsMobileHref}
                  className="hover:text-white"
                >
                  {contact.operationsMobile}
                </a>
              </p>
              <a
                href={`mailto:${contact.operationsEmail}`}
                className="break-all hover:text-white"
              >
                {contact.operationsEmail}
              </a>
            </div>
            <div className="h-px w-full bg-white/18" />
            <p className="text-sm leading-[normal] font-bold text-white/70">
              24 Hour Number
            </p>
            <a
              href={contact.phone24hHref}
              className="text-[28px] leading-[normal] font-black text-white"
            >
              {contact.phone24h}
            </a>
            <Link
              href="/contact"
              className={buttonClassName(
                { variant: "brand", size: "pill" },
                "w-full"
              )}
            >
              Get a Quote
            </Link>
          </div>
        </aside>
      </Container>
    </section>
  )
}
