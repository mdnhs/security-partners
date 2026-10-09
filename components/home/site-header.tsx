"use client"

import { useState } from "react"
import Image from "next/image"
import { MenuIcon, XIcon } from "lucide-react"

import { buttonClassName } from "@/components/ui/button"
import { Container } from "@/components/home/section"
import { contact, navLinks } from "@/components/home/data"

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="bg-brand-navy px-6 py-2.5 text-[13px] md:px-10">
        <Container className="flex flex-wrap items-center justify-between gap-x-7 gap-y-1">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-1">
            <a href={contact.phone24hHref} className="font-medium text-white">
              24 Hour Number: {contact.phone24h}
            </a>
            <a
              href={`mailto:${contact.email}`}
              className="text-white/75 hover:text-white"
            >
              {contact.email}
            </a>
          </div>
          <p className="hidden text-white/75 md:block">
            Office hours: {contact.hours}
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
          <a href="#top" className="relative h-[68px] w-[112px] shrink-0">
            <Image
              src="/images/logo.png"
              alt="Security Partners Ltd."
              fill
              sizes="112px"
              className="object-contain"
              priority
            />
          </a>

          <nav
            aria-label="Main"
            className="hidden items-center gap-9 text-base font-bold text-brand-navy lg:flex"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-brand-green"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="#contact"
              className={buttonClassName(
                { variant: "brand", size: "pill" },
                "max-sm:px-5 max-sm:py-3 max-sm:text-sm"
              )}
            >
              Get a Quote
            </a>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
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
            aria-label="Mobile"
            className="border-t border-brand-line pt-2 lg:hidden"
          >
            <Container className="flex flex-col py-2 text-base font-bold text-brand-navy">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-3 hover:bg-brand-surface"
                >
                  {link.label}
                </a>
              ))}
            </Container>
          </nav>
        )}
      </header>
    </>
  )
}
