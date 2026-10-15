"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MenuIcon, XIcon } from "lucide-react"

import { buttonClassName } from "@/components/ui/button"
import { Container } from "@/components/home/section"
import { cn } from "@/lib/utils"

type NavLink = { label: string; href: string }

// Label and value stay separate text nodes ("24 Hour Number: " + number),
// as on the static site: Chrome positions glyphs per text node.
export type SiteHeaderProps = {
  topBar: {
    phone24hLabel: string
    phone24h: string
    phone24hHref: string
    email: string
    hoursLabel: string
    hours: string
  }
  logo: { src: string; alt: string }
  links: NavLink[]
  cta: NavLink
  aria: {
    mainNav: string
    openMenu: string
    closeMenu: string
    mobileNav: string
  }
}

export function SiteHeader({
  topBar,
  logo,
  links,
  cta,
  aria,
}: SiteHeaderProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      <div className="bg-brand-navy px-6 py-2.5 text-[13px] md:px-10">
        <Container className="flex flex-wrap items-center justify-between gap-x-7 gap-y-1">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-1">
            <a href={topBar.phone24hHref} className="font-medium text-white">
              {`${topBar.phone24hLabel} `}
              {topBar.phone24h}
            </a>
            <a
              href={`mailto:${topBar.email}`}
              className="text-white/75 hover:text-white"
            >
              {topBar.email}
            </a>
          </div>
          <p className="hidden text-white/75 md:block">
            {`${topBar.hoursLabel} `}
            {topBar.hours}
          </p>
        </Container>
      </div>

      <header className="sticky top-0 z-50 bg-white px-6 py-3.5 shadow-[0px_4px_20px_0px_rgba(13,26,51,0.08)] md:px-10">
        <div
          aria-hidden
          data-scroll-progress
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-brand-green"
        />
        <Container className="flex items-center justify-between gap-6">
          <Link
            href={pathname === "/" ? "#top" : "/"}
            className="relative h-[68px] w-[112px] shrink-0"
          >
            <Image
              src={logo.src}
              alt={logo.alt}
              fill
              sizes="112px"
              className="object-contain"
              priority
            />
          </Link>

          <nav
            aria-label={aria.mainNav}
            className="hidden items-center gap-9 text-base font-bold text-brand-navy lg:flex"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "transition-colors hover:text-brand-green",
                  isActive(link.href) && "text-brand-green"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={cta.href}
              className={buttonClassName(
                { variant: "brand", size: "pill" },
                "max-sm:px-5 max-sm:py-3 max-sm:text-sm"
              )}
            >
              {cta.label}
            </Link>
            <button
              type="button"
              aria-label={open ? aria.closeMenu : aria.openMenu}
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex size-11 items-center justify-center rounded-full text-brand-navy hover:bg-brand-surface lg:hidden"
            >
              {open ? (
                <XIcon className="size-6" />
              ) : (
                <MenuIcon className="size-6" />
              )}
            </button>
          </div>
        </Container>

        {open && (
          <nav
            id="mobile-nav"
            aria-label={aria.mobileNav}
            className="border-t border-brand-line pt-2 lg:hidden"
          >
            <Container className="flex flex-col py-2 text-base font-bold text-brand-navy">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-2 py-3 hover:bg-brand-surface",
                    isActive(link.href) && "text-brand-green"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </Container>
          </nav>
        )}
      </header>
    </>
  )
}
