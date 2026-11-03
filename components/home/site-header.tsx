"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MenuIcon, XIcon } from "lucide-react"

import { buttonClassName } from "@/components/ui/button"
import { LogoAnimation } from "@/components/home/logo-animation"
import { Container } from "@/components/home/section"
import { cn } from "@/lib/utils"

// `children`: a hover/focus list under the link (Services: one per service).
// `icon`: a picture shown beside a list entry (the service's own icon).
type NavLink = {
  label: string
  href: string
  children?: NavLink[]
  icon?: string
}

/**
 * A header link with a list under it, open while the pointer or keyboard
 * focus is inside the link or the list, and dismissed with Escape (WCAG
 * 1.4.13: dismissible, hoverable, persistent). The link itself still goes to
 * its page. The list's top padding bridges the gap, so moving the pointer
 * down to it does not close it.
 */
function NavMenu({
  link,
  active,
  isActive,
}: {
  link: NavLink
  active: boolean
  isActive: (href: string) => boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLAnchorElement>(null)
  const dismissing = useRef(false)

  // Escape dismisses the list wherever the pointer or focus is (WCAG 1.4.13),
  // not only when focus is inside it.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setOpen(false)
      // Focus may sit in the list, which is about to be hidden.
      if (wrapRef.current?.contains(document.activeElement)) {
        dismissing.current = true
        topRef.current?.focus()
        dismissing.current = false
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  return (
    <div
      ref={wrapRef}
      // h-14 is the logo box's height, so the row's content ends where this
      // ends: the list below hangs from the header's bottom padding, not
      // from the link's text.
      className="relative flex h-14 items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => {
        if (!dismissing.current) setOpen(true)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false)
      }}
    >
      <Link
        ref={topRef}
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "transition-colors hover:text-brand-green",
          active && "text-brand-green"
        )}
      >
        {link.label}
      </Link>
      {/* Centred under the link. The list unrolls downward from the pointer
          like a scroll being pulled open (a clip that grows from the top,
          its shadow kept by the negative insets), then the services follow
          one after another; closing rolls it back up at once. The 22px top
          padding (12px header padding + 10px gap) bridges the way from the
          link, so the pointer can cross, and the container stays visible
          until the roll-up has finished. */}
      <div
        data-services-menu
        data-open={open}
        className="group/menu invisible absolute top-full left-1/2 z-10 min-w-76 -translate-x-1/2 pt-[22px] transition-[visibility] duration-[650ms] data-[open=true]:visible motion-reduce:transition-none"
      >
        <ul className="rounded-lg bg-white py-2 shadow-[0px_8px_30px_0px_rgba(13,26,51,0.14)] transition-[clip-path] duration-[650ms] ease-[cubic-bezier(0.45,0.05,0.25,1)] [clip-path:inset(0_-40px_100%_-40px)] group-data-[open=true]/menu:[clip-path:inset(0_-40px_-40px_-40px)] motion-reduce:transition-none">
          {link.children?.map((child, index) => (
            <li
              key={child.href}
              style={{
                transitionDelay: open ? `${180 + index * 70}ms` : "0ms",
              }}
              className="-translate-y-2 opacity-0 transition-[opacity,translate] duration-300 ease-out group-data-[open=true]/menu:translate-y-0 group-data-[open=true]/menu:opacity-100 motion-reduce:transition-none"
            >
              <Link
                href={child.href}
                aria-current={isActive(child.href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-brand-surface hover:text-brand-green",
                  isActive(child.href) && "text-brand-green"
                )}
              >
                {child.icon ? (
                  // The service card's tile at menu size: the same mint
                  // square, the picture a third larger than the tile and
                  // clipped by it.
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-brand-mint"
                  >
                    <span className="relative size-[54px] shrink-0">
                      <Image
                        src={child.icon}
                        alt=""
                        fill
                        sizes="54px"
                        className="object-contain"
                      />
                    </span>
                  </span>
                ) : null}
                {child.label}
              </Link>
            </li>
          ))}
        </ul>
        {/* The pointer: a turned square whose upper half shows, centred on
            the list's top edge and pointing up at the link. It pops in
            first, so the list appears to unroll from it. */}
        <span
          aria-hidden
          data-services-menu-arrow
          className="absolute top-[15px] left-1/2 z-10 size-3.5 -translate-x-1/2 scale-0 rotate-45 rounded-[2px] bg-white opacity-0 shadow-[-2px_-2px_6px_-3px_rgba(13,26,51,0.14)] transition-[opacity,scale] duration-200 ease-out group-data-[open=true]/menu:scale-100 group-data-[open=true]/menu:opacity-100 motion-reduce:transition-none"
        />
      </div>
    </div>
  )
}

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
  /** animation: Lottie file URL (settings.site.logoAnimation), absent = none. */
  logo: { src: string; alt: string; animation?: string }
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

      <header className="sticky top-0 z-50 bg-white px-6 py-3 shadow-[0px_4px_20px_0px_rgba(13,26,51,0.08)] md:px-10">
        <div
          aria-hidden
          data-scroll-progress
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-brand-green"
        />
        <Container className="flex items-center justify-between gap-6">
          <Link
            href={pathname === "/" ? "#top" : "/"}
            className="relative h-[56px] w-[92px] shrink-0"
          >
            <Image
              src={logo.src}
              alt={logo.alt}
              fill
              sizes="92px"
              className="object-contain"
              priority
            />
            {logo.animation ? <LogoAnimation src={logo.animation} /> : null}
          </Link>

          <nav
            aria-label={aria.mainNav}
            className="hidden items-center gap-9 text-base font-bold text-brand-navy lg:flex"
          >
            {links.map((link) =>
              link.children?.length ? (
                <NavMenu
                  key={link.href}
                  link={link}
                  active={isActive(link.href)}
                  isActive={isActive}
                />
              ) : (
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
              )
            )}
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
