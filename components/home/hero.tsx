import Image from "next/image"

import { buttonClassName } from "@/components/ui/button"
import { Container } from "@/components/home/section"
import { contact } from "@/components/home/data"

const stats = [
  { value: "18+", label: "Years in business", count: 18, suffix: "+" },
  { value: "24/7", label: "Operations team" },
  { value: "Nationwide", label: "Coverage across Ireland" },
]

export function Hero() {
  return (
    <section
      id="top"
      data-hero
      className="relative flex min-h-[640px] items-center overflow-hidden px-6 py-20 md:px-10 lg:h-[720px] lg:py-0"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div data-hero-media className="absolute inset-0 will-change-transform">
          <Image
            src="/images/hero.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-linear-to-r from-[rgba(13,27,54,0.92)] via-[rgba(13,27,54,0.6)] via-55% to-[rgba(13,27,54,0.1)] max-lg:to-[rgba(13,27,54,0.6)]" />
      </div>

      <Container className="relative">
        <div
          data-hero-content
          className="flex max-w-[640px] flex-col items-start gap-6"
        >
          <div
            data-hero-item
            className="flex items-center gap-2 rounded-full border border-brand-green/60 bg-brand-green/18 px-4 py-2"
          >
            <Image src="/images/ellipse.svg" alt="" width={8} height={8} />
            <p className="text-[13px] font-bold tracking-[0.04em] whitespace-pre text-white">
              {"Mountmellick, Co. Laois  •  Since 2008"}
            </p>
          </div>

          <h1
            data-hero-title
            className="text-5xl leading-[1.05] font-black tracking-[-0.01em] text-white md:text-[68px] md:whitespace-nowrap"
          >
            Security Partners Ltd.
          </h1>
          <p
            data-hero-item
            className="text-2xl font-bold text-brand-green md:text-[28px]"
          >
            Watching Over You
          </p>
          <p
            data-hero-item
            className="text-lg leading-[1.55] text-white/85 md:text-[19px]"
          >
            Proactive, flexible and customer-focused security services across
            Ireland, backed by a dedicated 24/7 operations team.
          </p>

          <div data-hero-item className="flex flex-wrap gap-4 pt-3">
            <a
              href="#services"
              className={buttonClassName({ variant: "brand", size: "pill" })}
            >
              Our Services
            </a>
            <a
              href={contact.phone24hHref}
              className={buttonClassName({
                variant: "brand-outline",
                size: "pill",
              })}
            >
              Call 24/7: {contact.phone24h}
            </a>
          </div>

          <dl className="flex flex-wrap gap-x-10 gap-y-6 pt-7">
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
  )
}
