import { Fragment } from "react"
import Image from "next/image"
import Link from "next/link"

import { Container } from "@/components/home/section"
import { cn } from "@/lib/utils"

export type PageHeroProps = {
  image: string
  trail?: { label: string; href: string }[]
  crumb: string
  title: string
  /** Omitted (undefined) renders no paragraph; every content page passes one. */
  description?: string
  wideDescription?: boolean
  /** Breadcrumb "Home" label and the nav's aria-label (settings.microcopy). */
  homeLabel: string
  ariaLabel: string
}

export function PageHero({
  image,
  trail = [],
  crumb,
  title,
  description,
  wideDescription,
  homeLabel,
  ariaLabel,
}: PageHeroProps) {
  return (
    <section
      data-hero
      className="relative overflow-hidden px-6 pt-20 pb-24 md:px-10 lg:pt-28 lg:pb-30"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div data-hero-media className="absolute inset-0 will-change-transform">
          <Image
            src={image}
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
        <div data-hero-content className="flex flex-col items-start gap-[22px]">
          <nav data-hero-item aria-label={ariaLabel}>
            <ol className="flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[13px] leading-[normal] font-bold">
              <li>
                <Link href="/" className="text-white/85 hover:text-white">
                  {homeLabel}
                </Link>
              </li>
              {trail.map((item) => (
                <Fragment key={item.href}>
                  <li aria-hidden className="text-white/50">
                    /
                  </li>
                  <li>
                    <Link
                      href={item.href}
                      className="text-white/85 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                </Fragment>
              ))}
              <li aria-hidden className="text-white/50">
                /
              </li>
              <li aria-current="page" className="text-brand-green">
                {crumb}
              </li>
            </ol>
          </nav>

          <h1
            data-hero-title
            className="max-w-[820px] text-5xl leading-[1.1] font-black tracking-[-0.01em] text-white md:text-[64px]"
          >
            {title}
          </h1>
          {description !== undefined && (
            <p
              data-hero-item
              className={cn(
                "text-lg leading-[1.6] text-white/85 md:text-[19px]",
                wideDescription ? "max-w-[760px]" : "max-w-[640px]"
              )}
            >
              {description}
            </p>
          )}
        </div>
      </Container>
    </section>
  )
}
