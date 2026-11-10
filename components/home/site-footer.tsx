import {
  ChevronRight,
  Clock,
  FileText,
  Mail,
  MapPin,
  Phone,
} from "lucide-react"
import { Fragment } from "react"
import Image from "next/image"
import Link from "next/link"

import { SlideInBar } from "@/components/motion/slide-in-bar"
import { LogoAnimation } from "@/components/home/logo-animation"
import { Container } from "@/components/home/section"

const headingClass = "text-base font-black tracking-[0.04em] text-brand-green"
const linkClass =
  "text-[15px] leading-normal text-white/80 [overflow-wrap:anywhere] hover:text-white"

type FooterLink = { label: string; href: string }

export type SiteFooterProps = {
  /** animation: Lottie file URL (settings.site.logoAnimation), absent = none. */
  logo: { src: string; alt: string; animation?: string }
  tagline: string
  quickLinks: { heading: string; ariaLabel: string; links: FooterLink[] }
  contact: {
    heading: string
    addressLine1: string
    addressLine2: string
    telLabel: string
    office: string
    officeHref: string
    phone24hLabel: string
    phone24h: string
    phone24hHref: string
    email: string
  }
  group: {
    heading: string
    telLabel: string
    companies: { name: string; phone: string; site: string; logo: string }[]
  }
  copyright: string
  legal: { privacy: FooterLink; terms: FooterLink; extra: FooterLink[] }
}

export function SiteFooter({
  logo,
  tagline,
  quickLinks,
  contact,
  group,
  copyright,
  legal,
}: SiteFooterProps) {
  return (
    <footer
      data-site-footer
      className="relative isolate overflow-hidden bg-brand-navy px-5 pt-12 pb-28 md:px-10 md:pt-20 md:pb-8"
    >
      <div
        aria-hidden="true"
        className="footer-aurora pointer-events-none absolute inset-0 -z-10"
      >
        <span />
        <span />
        <span />
      </div>
      <Container className="flex flex-col gap-8 md:gap-12">
        <div
          data-stagger
          className="grid grid-cols-2 gap-x-4 gap-y-8 md:gap-x-12 md:gap-y-12 xl:flex xl:gap-14"
        >
          <div className="flex flex-col items-start gap-5 max-md:col-span-2 xl:w-[340px] xl:shrink-0">
            <div className="rounded-xl bg-white px-3 py-2 md:rounded-[14px] md:px-4 md:py-2.5">
              <div className="relative h-14 w-[92px] md:h-[66px] md:w-[110px]">
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  fill
                  sizes="110px"
                  className="object-contain"
                />
                {logo.animation ? <LogoAnimation src={logo.animation} /> : null}
              </div>
            </div>
            <p className="text-sm leading-[22px] text-white/70 md:text-[15px] md:leading-[1.65]">
              {tagline}
            </p>
          </div>

          <nav
            aria-label={quickLinks.ariaLabel}
            className="flex flex-1 flex-col gap-1 max-md:col-span-2 md:gap-3.5"
          >
            <p className={headingClass}>{quickLinks.heading}</p>
            <div className="flex flex-col max-md:grid max-md:grid-flow-col max-md:grid-cols-2 max-md:grid-rows-3 max-md:gap-x-4 md:gap-3.5">
              {quickLinks.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${linkClass} max-md:py-2.5`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>

          <address className="flex flex-col gap-3 not-italic max-md:col-span-2 md:hidden">
            <p className={headingClass}>{contact.heading}</p>
            <p className="flex items-start gap-2.5 text-sm leading-5 text-white/85">
              <MapPin
                aria-hidden
                className="size-[18px] shrink-0 text-brand-green"
              />
              {`${contact.addressLine1}, ${contact.addressLine2}`}
            </p>
            <a
              href={contact.officeHref}
              className="flex items-start gap-2.5 text-sm leading-5 text-white/85"
            >
              <Phone
                aria-hidden
                className="size-[18px] shrink-0 text-brand-green"
              />
              {`${contact.telLabel} ${contact.office}`}
            </a>
            <a
              href={contact.phone24hHref}
              className="flex items-start gap-2.5 text-sm leading-5 text-white/85"
            >
              <Clock
                aria-hidden
                className="size-[18px] shrink-0 text-brand-green"
              />
              {`${contact.phone24hLabel} ${contact.phone24h}`}
            </a>
            <a
              href={`mailto:${contact.email}`}
              className="flex items-start gap-2.5 text-sm leading-5 [overflow-wrap:anywhere] text-white/85"
            >
              <Mail
                aria-hidden
                className="size-[18px] shrink-0 text-brand-green"
              />
              {contact.email}
            </a>
          </address>

          <address className="flex flex-1 flex-col gap-3.5 not-italic max-md:hidden">
            <p className={headingClass}>{contact.heading}</p>
            <p className={linkClass}>{contact.addressLine1}</p>
            <p className={linkClass}>{contact.addressLine2}</p>
            <a href={contact.officeHref} className={linkClass}>
              {`${contact.telLabel} `}
              {contact.office}
            </a>
            <a href={contact.phone24hHref} className={linkClass}>
              {`${contact.phone24hLabel} `}
              {contact.phone24h}
            </a>
            <a href={`mailto:${contact.email}`} className={linkClass}>
              {contact.email}
            </a>
          </address>

          <div className="flex flex-col gap-4 max-md:col-span-2 xl:w-[300px] xl:shrink-0">
            <p className={headingClass}>{group.heading}</p>
            {group.companies.map((company) => (
              <a
                key={company.name}
                href={`https://${company.site}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3.5 rounded-2xl bg-white/6 px-3.5 py-3 transition-colors hover:bg-white/10 md:px-4 md:py-3.5"
              >
                <div className="flex h-14 w-[68px] shrink-0 items-center justify-center rounded-[10px] bg-white p-1.5 md:w-[72px]">
                  <div className="relative h-11 w-[56px] md:w-[60px]">
                    <Image
                      src={company.logo}
                      alt=""
                      fill
                      sizes="60px"
                      className="object-contain"
                    />
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-[15px] font-bold text-white">
                    {company.name}
                  </p>
                  <p className="text-[13px] text-white/70">
                    {`${group.telLabel} `}
                    {company.phone}
                  </p>
                  <p className="text-[13px] text-white/70">{company.site}</p>
                </div>
                <ChevronRight
                  aria-hidden
                  className="ml-auto size-[18px] shrink-0 text-white/60 md:hidden"
                />
              </a>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/12" />

        <div className="flex flex-col items-center justify-between gap-2 text-center text-[13px] text-white/60 sm:flex-row sm:gap-3 sm:text-left sm:text-sm">
          <p>{copyright}</p>
          <p className="flex flex-wrap items-baseline justify-center">
            {[legal.privacy, legal.terms, ...legal.extra].map((link, index) => (
              <Fragment key={`${link.href}-${index}`}>
                {index > 0 ? (
                  <span aria-hidden className="whitespace-pre">
                    {"   ·   "}
                  </span>
                ) : null}
                <a href={link.href} className="hover:text-white">
                  {link.label}
                </a>
              </Fragment>
            ))}
          </p>
        </div>
      </Container>
      {/* Phones: call / quote shortcuts pinned to the bottom of the screen. */}
      <SlideInBar
        data-site-cta
        className="fixed inset-x-0 bottom-0 z-40 flex gap-2.5 border-t border-brand-line bg-white px-4 pt-3 pb-[max(1.75rem,env(safe-area-inset-bottom))] shadow-[0px_-6px_20px_0px_rgba(13,27,54,0.1)] md:hidden"
      >
        <a
          href={contact.phone24hHref}
          className="flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-full border-[1.5px] border-brand-blue bg-white px-4 text-base font-bold whitespace-nowrap text-brand-blue"
        >
          <Phone aria-hidden className="size-5" />
          Call 24/7
        </a>
        <Link
          href="/contact"
          className="flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-brand-green px-4 text-base font-bold whitespace-nowrap text-white"
        >
          <FileText aria-hidden className="size-5" />
          Get a Quote
        </Link>
      </SlideInBar>
    </footer>
  )
}
