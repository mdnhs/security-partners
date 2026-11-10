"use client"

import { LazyMotion, MotionConfig, domAnimation } from "motion/react"
import * as m from "motion/react-m"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronRight,
  Clock,
  FileText,
  MenuIcon,
  Mail,
  Phone,
  XIcon,
} from "lucide-react"

import { buttonClassName } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
  const pathname = usePathname()
  const wrapRef = useRef<HTMLDivElement>(null)

  // Next keeps the page you left alive but hidden, state and all, and shows
  // it again on the way back: a list left open would still be open. Hiding a
  // page (and a route change) runs a layout effect's cleanup, which closes
  // the list, so it is closed when the page returns.
  useLayoutEffect(() => {
    return () => setOpen(false)
  }, [pathname])
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
      // Any click in the link or the list is a navigation: close first, so
      // the page being left is stored closed.
      onClickCapture={() => setOpen(false)}
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
  // Past the very top the bar turns to blurred glass, so the page shows
  // through it as it scrolls underneath.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8)
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])
  const pathname = usePathname()
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      <div
        data-site-topbar
        className="hidden bg-brand-navy px-6 py-2.5 text-[13px] md:block md:px-10"
      >
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

      <header
        data-site-header
        className={cn(
          "sticky top-0 z-50 border-b border-brand-line px-5 py-2.5 shadow-[0px_4px_20px_0px_rgba(13,26,51,0.08)] transition-[background-color,backdrop-filter] duration-300 motion-reduce:transition-none md:border-b-0 md:px-6 md:px-10 md:py-3",
          scrolled
            ? "bg-white/55 backdrop-blur-lg backdrop-saturate-150"
            : "bg-white"
        )}
      >
        <div
          aria-hidden
          data-scroll-progress
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-brand-green"
        />
        <Container className="flex items-center justify-between gap-6">
          <Link
            href={pathname === "/" ? "#top" : "/"}
            className="relative h-12 w-20 shrink-0 md:h-[56px] md:w-[92px]"
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
                "max-lg:hidden"
              )}
            >
              {cta.label}
            </Link>
            <a
              href={topBar.phone24hHref}
              aria-label={`${topBar.phone24hLabel} ${topBar.phone24h}`}
              className="inline-flex size-11 items-center justify-center rounded-full bg-brand-mint text-brand-green-dark md:hidden"
            >
              <Phone aria-hidden className="size-5" />
            </a>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                aria-label={aria.openMenu}
                className="inline-flex size-11 items-center justify-center rounded-full bg-brand-navy text-white hover:bg-brand-navy/90 lg:hidden"
              >
                <MenuIcon className="size-5" />
              </SheetTrigger>
              <SheetContent
                side="right"
                showCloseButton={false}
                data-lenis-prevent
                className="w-full gap-0 bg-white p-0 text-brand-navy sm:w-[min(88vw,22rem)] lg:hidden"
              >
                <SheetHeader className="flex-row items-center justify-between border-b border-brand-line px-5 py-2.5">
                  <SheetTitle className="sr-only">{aria.mobileNav}</SheetTitle>
                  <span aria-hidden className="relative h-12 w-20">
                    <Image
                      src={logo.src}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-contain"
                    />
                  </span>
                  <SheetClose
                    aria-label={aria.closeMenu}
                    className="inline-flex size-11 items-center justify-center rounded-full bg-brand-navy text-white hover:bg-brand-navy/90"
                  >
                    <XIcon className="size-5" />
                  </SheetClose>
                </SheetHeader>
                <MotionConfig reducedMotion="user">
                  <LazyMotion features={domAnimation} strict>
                    <nav
                      aria-label={aria.mobileNav}
                      className="flex flex-1 flex-col overflow-y-auto px-5 py-2 text-xl font-black"
                    >
                      {links.map((link, index) => (
                        <m.div
                          key={link.href}
                          initial={{ opacity: 0, x: 18 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            duration: 0.4,
                            ease: [0.22, 1, 0.36, 1],
                            delay: 0.12 + index * 0.05,
                          }}
                        >
                          <SheetClose
                            nativeButton={false}
                            render={
                              <Link
                                href={link.href}
                                aria-current={
                                  isActive(link.href) ? "page" : undefined
                                }
                                className={cn(
                                  "flex items-center gap-2.5 border-b border-brand-line py-[18px] hover:text-brand-green",
                                  isActive(link.href) && "text-brand-green"
                                )}
                              />
                            }
                          >
                            <span className="flex-1">{link.label}</span>
                            {link.href.startsWith("/careers") ? (
                              <span className="rounded-full bg-brand-mint px-2.5 py-1 text-xs font-bold text-brand-green-dark">
                                We&apos;re hiring
                              </span>
                            ) : null}
                            <ChevronRight
                              aria-hidden
                              className="size-5 shrink-0 text-brand-ink"
                            />
                          </SheetClose>
                        </m.div>
                      ))}
                    </nav>
                  </LazyMotion>
                </MotionConfig>
                <div className="flex flex-col gap-3 bg-brand-surface px-5 pt-5 pb-8">
                  <a
                    href={topBar.phone24hHref}
                    className={buttonClassName(
                      { variant: "brand", size: "pill" },
                      "h-[52px] w-full gap-2 py-0"
                    )}
                  >
                    <Phone aria-hidden className="size-5" />
                    {`Call 24/7: ${topBar.phone24h}`}
                  </a>
                  <SheetClose
                    nativeButton={false}
                    render={
                      <Link
                        href={cta.href}
                        className={buttonClassName(
                          { variant: "brand-outline-blue", size: "pill" },
                          "h-[52px] w-full gap-2 bg-white py-0 hover:bg-brand-blue"
                        )}
                      />
                    }
                  >
                    <FileText aria-hidden className="size-5" />
                    {cta.label}
                  </SheetClose>
                  <div className="flex flex-col gap-2 pt-1.5 text-[13px] font-medium text-brand-ink">
                    <a
                      href={`mailto:${topBar.email}`}
                      className="flex items-center gap-2"
                    >
                      <Mail aria-hidden className="size-4 text-brand-blue" />
                      {topBar.email}
                    </a>
                    <p className="flex items-center gap-2">
                      <Clock aria-hidden className="size-4 text-brand-blue" />
                      {`${topBar.hoursLabel} ${topBar.hours}`}
                    </p>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </Container>
      </header>
    </>
  )
}
