import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ usePathname: () => "/about" }))

import { SiteHeader, type SiteHeaderProps } from "@/components/home/site-header"

const header = (withMenu: boolean): SiteHeaderProps => ({
  topBar: {
    phone24hLabel: "24h",
    phone24h: "1",
    phone24hHref: "tel:1",
    email: "a@b.c",
    hoursLabel: "Hours",
    hours: "9-5",
  },
  logo: { src: "/images/logo.png", alt: "Security Partners Ltd." },
  links: [
    { label: "About", href: "/about" },
    {
      label: "Services",
      href: "/services",
      ...(withMenu
        ? {
            children: [
              { label: "Alarm Responses", href: "/services/alarm-responses" },
              { label: "Mobile Patrols", href: "/services/mobile-patrols" },
            ],
          }
        : {}),
    },
  ],
  cta: { label: "Contact", href: "/contact" },
  aria: {
    mainNav: "Main",
    openMenu: "Open",
    closeMenu: "Close",
    mobileNav: "Mobile",
  },
})

const desktopNav = () => screen.getByRole("navigation", { name: "Main" })
const submenu = () => desktopNav().querySelector("[data-services-menu]")

describe("header Services menu", () => {
  it("lists the services when Services is hovered, and hides them after", async () => {
    const user = userEvent.setup()
    render(<SiteHeader {...header(true)} />)
    expect(submenu()).toHaveAttribute("data-open", "false")
    await user.hover(desktopNav().querySelector('a[href="/services"]')!)
    expect(submenu()).toHaveAttribute("data-open", "true")
    const links = [...submenu()!.querySelectorAll("a")]
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Alarm Responses", "/services/alarm-responses"],
      ["Mobile Patrols", "/services/mobile-patrols"],
    ])
    await user.unhover(desktopNav().querySelector('a[href="/services"]')!)
    expect(submenu()).toHaveAttribute("data-open", "false")
  })

  it("stays open while the pointer moves from Services onto the list", async () => {
    const user = userEvent.setup()
    render(<SiteHeader {...header(true)} />)
    await user.hover(desktopNav().querySelector('a[href="/services"]')!)
    await user.hover(submenu()!.querySelector("a")!)
    expect(submenu()).toHaveAttribute("data-open", "true")
  })

  it("opens on keyboard focus and closes with Escape (WCAG 1.4.13)", async () => {
    const user = userEvent.setup()
    render(<SiteHeader {...header(true)} />)
    const services = desktopNav().querySelector<HTMLAnchorElement>(
      'a[href="/services"]'
    )!
    act(() => services.focus())
    expect(submenu()).toHaveAttribute("data-open", "true")
    await user.keyboard("{Escape}")
    expect(submenu()).toHaveAttribute("data-open", "false")
    // Focus stays on the link: Escape only dismisses the extra content.
    expect(services).toHaveFocus()
  })

  it("Escape also closes a menu that is only open by hover", async () => {
    const user = userEvent.setup()
    render(<SiteHeader {...header(true)} />)
    await user.hover(desktopNav().querySelector('a[href="/services"]')!)
    expect(submenu()).toHaveAttribute("data-open", "true")
    await user.keyboard("{Escape}")
    expect(submenu()).toHaveAttribute("data-open", "false")
  })

  it("closes when focus leaves the menu", () => {
    render(<SiteHeader {...header(true)} />)
    const services = desktopNav().querySelector<HTMLAnchorElement>(
      'a[href="/services"]'
    )!
    act(() => services.focus())
    expect(submenu()).toHaveAttribute("data-open", "true")
    fireEvent.blur(services, { relatedTarget: document.body })
    expect(submenu()).toHaveAttribute("data-open", "false")
  })

  it("Services itself still links to the services page", () => {
    render(<SiteHeader {...header(true)} />)
    expect(desktopNav().querySelector('a[href="/services"]')).toHaveTextContent(
      "Services"
    )
  })

  it("without services there is no menu and the markup is plain", () => {
    render(<SiteHeader {...header(false)} />)
    expect(submenu()).toBeNull()
  })
})
