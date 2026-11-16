import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Activity } from "react"
import { describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({ path: "/about" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }))

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
              {
                label: "Alarm Responses",
                href: "/services/alarm-responses",
                icon: "/images/service-alarm.png",
              },
              {
                label: "Mobile Patrols",
                href: "/services/mobile-patrols",
                icon: "/images/service-patrol.png",
              },
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

  it("shows each service's icon beside its name, hidden from screen readers", () => {
    render(<SiteHeader {...header(true)} />)
    const items = [...submenu()!.querySelectorAll("li")]
    expect(items).toHaveLength(2)
    for (const [i, icon] of ["service-alarm", "service-patrol"].entries()) {
      const img = items[i].querySelector("img")!
      expect(decodeURIComponent(img.getAttribute("src")!)).toContain(icon)
      expect(img).toHaveAttribute("alt", "")
    }
    // The name is still the link's text.
    expect(items[0].querySelector("a")).toHaveTextContent("Alarm Responses")
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

describe("header while scrolling", () => {
  const scrollTo = (y: number) => {
    act(() => {
      Object.defineProperty(window, "scrollY", { value: y, configurable: true })
      window.dispatchEvent(new Event("scroll"))
    })
  }

  it("is solid white at the top, then a blurred see-through glass once scrolled", () => {
    const { container } = render(<SiteHeader {...header(true)} />)
    const bar = container.querySelector("header")!
    scrollTo(0)
    expect(bar).toHaveClass("bg-white")
    expect(bar).not.toHaveClass("backdrop-blur-lg")

    scrollTo(120)
    expect(bar).toHaveClass("bg-white/55", "backdrop-blur-lg")
    expect(bar).not.toHaveClass("bg-white")

    scrollTo(0)
    expect(bar).toHaveClass("bg-white")
    expect(bar).not.toHaveClass("backdrop-blur-lg")
  })

  it("takes the scrolled look on mount when the page opens already scrolled", () => {
    Object.defineProperty(window, "scrollY", { value: 400, configurable: true })
    const { container } = render(<SiteHeader {...header(true)} />)
    expect(container.querySelector("header")).toHaveClass("backdrop-blur-lg")
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true })
  })
})

describe("header Services menu across pages", () => {
  it("comes back closed when its page is shown again (Next keeps hidden pages alive)", async () => {
    const user = userEvent.setup()
    const page = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <SiteHeader {...header(true)} />
      </Activity>
    )
    const { rerender } = render(page("visible"))
    await user.hover(desktopNav().querySelector('a[href="/services"]')!)
    expect(submenu()).toHaveAttribute("data-open", "true")

    // The visitor leaves the page with the list open, then comes back.
    rerender(page("hidden"))
    rerender(page("visible"))
    expect(submenu()).toHaveAttribute("data-open", "false")
  })

  it("closes when the route changes while it is open", async () => {
    const user = userEvent.setup()
    nav.path = "/about"
    const { rerender } = render(<SiteHeader {...header(true)} />)
    await user.hover(desktopNav().querySelector('a[href="/services"]')!)
    expect(submenu()).toHaveAttribute("data-open", "true")
    nav.path = "/services/alarm-responses"
    rerender(<SiteHeader {...header(true)} />)
    expect(submenu()).toHaveAttribute("data-open", "false")
    nav.path = "/about"
  })

  it("closes at once when a link in the list is clicked", async () => {
    const user = userEvent.setup()
    render(<SiteHeader {...header(true)} />)
    await user.hover(desktopNav().querySelector('a[href="/services"]')!)
    const link = submenu()!.querySelector("a")!
    link.addEventListener("click", (event) => event.preventDefault())
    await user.click(link)
    expect(submenu()).toHaveAttribute("data-open", "false")
  })
})

describe("desktop nav arrow", () => {
  it("shows an arrow beside a link that has a submenu, and only there", () => {
    nav.path = "/about"
    render(<SiteHeader {...header(true)} />)
    const services = desktopNav().querySelector('a[href="/services"]')!
    expect(services.querySelector("[data-nav-arrow]")).not.toBeNull()
    expect(
      desktopNav().querySelector('a[href="/about"] [data-nav-arrow]')
    ).toBeNull()
  })

  it("turns the arrow up while the submenu is open", async () => {
    nav.path = "/about"
    const user = userEvent.setup()
    render(<SiteHeader {...header(true)} />)
    const link = desktopNav().querySelector('a[href="/services"]')!
    const arrow = () => link.querySelector("[data-nav-arrow]")!
    expect(arrow().getAttribute("class")).not.toContain("rotate-180")
    await user.hover(link)
    expect(arrow().getAttribute("class")).toContain("rotate-180")
    await user.unhover(link)
    expect(arrow().getAttribute("class")).not.toContain("rotate-180")
  })

  it("has no arrow when no link has a submenu", () => {
    nav.path = "/about"
    render(<SiteHeader {...header(false)} />)
    expect(desktopNav().querySelector("[data-nav-arrow]")).toBeNull()
  })
})

describe("mobile menu submenu", () => {
  const openSheet = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "Open" }))
    return screen.findByRole("navigation", { name: "Mobile" })
  }

  it("shows the arrow, and the submenu, only for a link that has one", async () => {
    nav.path = "/about"
    const user = userEvent.setup()
    render(<SiteHeader {...header(true)} />)
    const mobile = await openSheet(user)
    // Services has a toggle beside its label; About has none.
    expect(mobile.querySelectorAll("button[aria-expanded]")).toHaveLength(1)
    const toggle = mobile.querySelector("button[aria-expanded]")!
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(mobile.querySelector('a[href^="/services/"]')).toBeNull()
  })

  it("opens and closes the list on the arrow; the label still goes to the page", async () => {
    nav.path = "/about"
    const user = userEvent.setup()
    render(<SiteHeader {...header(true)} />)
    const mobile = await openSheet(user)
    const toggle = mobile.querySelector("button[aria-expanded]")!
    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(
      mobile.querySelector('a[href="/services/alarm-responses"]')
    ).toHaveTextContent("Alarm Responses")
    expect(
      mobile.querySelector('a[href="/services/mobile-patrols"]')
    ).toHaveTextContent("Mobile Patrols")
    // The label is an ordinary link to the page.
    expect(mobile.querySelector('a[href="/services"]')).toHaveTextContent(
      "Services"
    )
    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
  })

  it("shows each service's icon beside its name in the opened list", async () => {
    nav.path = "/about"
    const user = userEvent.setup()
    render(<SiteHeader {...header(true)} />)
    const mobile = await openSheet(user)
    await user.click(mobile.querySelector("button[aria-expanded]")!)
    const link = mobile.querySelector('a[href="/services/alarm-responses"]')!
    const tile = link.querySelector("[aria-hidden]")!
    expect(tile.querySelector("img")).not.toBeNull()
    expect(tile.querySelector("img")!.getAttribute("src")).toContain(
      "service-alarm"
    )
    // The name stays the link's accessible text; the picture is decoration.
    expect(link).toHaveTextContent("Alarm Responses")
  })

  it("starts open on a page under the link", async () => {
    nav.path = "/services/alarm-responses"
    const user = userEvent.setup()
    render(<SiteHeader {...header(true)} />)
    const mobile = await openSheet(user)
    expect(mobile.querySelector("button[aria-expanded]")).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    nav.path = "/about"
  })

  it("has no toggle when no link has a submenu", async () => {
    nav.path = "/about"
    const user = userEvent.setup()
    render(<SiteHeader {...header(false)} />)
    const mobile = await openSheet(user)
    expect(mobile.querySelector("button[aria-expanded]")).toBeNull()
  })
})
