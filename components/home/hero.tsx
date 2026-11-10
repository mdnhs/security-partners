import { FileText, Phone } from "lucide-react"
import Image from "next/image"

import { buttonClassName } from "@/components/ui/button"
import { Container } from "@/components/home/section"

type HeroLink = { label: string; href: string }

export type HeroProps = {
  eyebrow: string
  heading: string
  tagline: string
  subheading: string
  backgroundImage: string
  primaryCta: HeroLink
  /** Label as text parts (lib/interpolate interpolateParts). */
  secondaryCta: { label: string[]; href: string }
  stats: { value: string; label: string; count?: number; suffix?: string }[]
}

export function Hero({
  eyebrow,
  heading,
  tagline,
  subheading,
  backgroundImage,
  primaryCta,
  secondaryCta,
  stats,
}: HeroProps) {
  return (
    <>
      <section
        id="top"
        data-hero
        className="relative flex min-h-[660px] items-end overflow-hidden px-5 pt-10 pb-6 md:min-h-[640px] md:items-center md:px-10 md:py-20 lg:h-[720px] lg:py-0"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            data-hero-media
            className="absolute inset-0 will-change-transform"
          >
            <Image
              src={backgroundImage}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover max-md:object-[30%_top]"
            />
          </div>
          <div className="absolute inset-0 bg-linear-to-r from-[rgba(13,27,54,0.92)] via-[rgba(13,27,54,0.6)] via-55% to-[rgba(13,27,54,0.1)] max-lg:to-[rgba(13,27,54,0.6)] max-md:bg-[linear-gradient(180deg,rgba(13,27,54,0.15)_0%,rgba(13,27,54,0.2)_30%,rgba(13,27,54,0.7)_55%,#0d1b36_100%)]" />
        </div>

        <Container className="relative">
          <div
            data-hero-content
            className="flex w-full max-w-[640px] flex-col items-start gap-4 md:gap-6"
          >
            <div
              data-hero-item
              className="flex items-center gap-2 rounded-full bg-brand-green/22 px-3.5 py-[7px] md:border md:border-brand-green/60 md:bg-brand-green/18 md:px-4 md:py-2"
            >
              <Image src="/images/ellipse.svg" alt="" width={8} height={8} />
              <p className="text-xs font-bold whitespace-pre text-white md:text-[13px] md:tracking-[0.04em]">
                {eyebrow}
              </p>
            </div>

            <h1
              data-hero-title
              className="text-[40px] leading-[44px] font-black tracking-[-0.01em] text-white md:text-5xl md:text-[68px] md:leading-[1.05] md:whitespace-nowrap"
            >
              {heading}
            </h1>
            <p
              data-hero-item
              className="text-[22px] leading-7 font-bold text-brand-green md:text-[28px] md:leading-normal"
            >
              {tagline}
            </p>
            <p
              data-hero-item
              className="text-base leading-6 text-white/85 md:text-[19px] md:leading-[1.55]"
            >
              {subheading}
            </p>

            <div
              data-hero-item
              className="flex w-full flex-col gap-3 pt-1 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-4 sm:pt-3"
            >
              <a
                href={primaryCta.href}
                className={buttonClassName(
                  { variant: "brand", size: "pill" },
                  "max-sm:h-[52px] max-sm:w-full max-sm:gap-2 max-sm:py-0"
                )}
              >
                <HeroCtaIcon href={primaryCta.href} />
                {primaryCta.label}
              </a>
              <a
                href={secondaryCta.href}
                className={buttonClassName(
                  { variant: "brand-outline", size: "pill" },
                  "max-sm:h-[52px] max-sm:w-full max-sm:gap-2 max-sm:border-white/45 max-sm:bg-white/8 max-sm:py-0"
                )}
              >
                <HeroCtaIcon href={secondaryCta.href} />
                {secondaryCta.label}
              </a>
            </div>

            <dl className="flex flex-wrap gap-x-10 gap-y-6 pt-7 max-md:hidden">
              {stats.map((stat) => (
                <div
                  key={stat.value}
                  data-hero-item
                  className="flex flex-col-reverse gap-1"
                >
                  <dt className="text-sm text-white/70">{stat.label}</dt>
                  <dd
                    data-count={stat.count}
                    data-suffix={stat.suffix}
                    className="text-[26px] font-black text-white tabular-nums"
                  >
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </section>
      <div className="bg-brand-navy px-5 pb-7 md:hidden">
        <dl className="flex items-center rounded-2xl border border-white/16 bg-white/8 px-2 py-4">
          {stats.map((stat, i) => (
            <div key={stat.value} className="flex min-w-0 flex-1 items-center">
              {i > 0 && <span aria-hidden className="h-9 w-px bg-white/20" />}
              <div className="flex min-w-0 flex-1 flex-col-reverse items-center gap-0.5 px-1 text-center">
                <dt className="text-xs leading-4 text-white/70">
                  {stat.label}
                </dt>
                <dd
                  className={
                    "leading-7 font-black text-white " +
                    (stat.value.length > 6 ? "text-lg" : "text-[22px]")
                  }
                >
                  {stat.value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </>
  )
}

function HeroCtaIcon({ href }: { href: string }) {
  const Icon = href.startsWith("tel:") ? Phone : FileText
  return <Icon aria-hidden className="size-5 sm:hidden" />
}
