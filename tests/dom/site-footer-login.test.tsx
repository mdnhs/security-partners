import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { SiteFooter, type SiteFooterProps } from "@/components/home/site-footer"

const footer = (
  extra: SiteFooterProps["legal"]["extra"] = []
): SiteFooterProps => ({
  logo: { src: "/images/logo.png", alt: "Security Partners Ltd." },
  tagline: "t",
  quickLinks: { heading: "Links", ariaLabel: "Footer", links: [] },
  contact: {
    heading: "Contact",
    addressLine1: "1",
    addressLine2: "2",
    telLabel: "Tel",
    office: "1",
    officeHref: "tel:1",
    phone24hLabel: "24h",
    phone24h: "1",
    phone24hHref: "tel:1",
    email: "a@b.c",
  },
  group: { heading: "Group", telLabel: "Tel", companies: [] },
  copyright: "c",
  legal: {
    privacy: { label: "Privacy", href: "/privacy" },
    terms: { label: "Terms", href: "/terms" },
    extra,
  },
})

/** The attributes of the footer's Login anchor, whatever their order. */
function loginAnchor(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html")
  return [...doc.querySelectorAll("a")].find((a) => a.textContent === "Login")
}

describe("footer Login link", () => {
  it("is always there, after Privacy and Terms, and goes to the admin sign-in", () => {
    const html = renderToStaticMarkup(<SiteFooter {...footer()} />)
    expect(loginAnchor(html)?.getAttribute("href")).toBe("/admin/sign-in")
    expect(html.indexOf(">Terms<")).toBeLessThan(html.indexOf(">Login<"))
  })

  it("stays last when published legal pages are added", () => {
    const html = renderToStaticMarkup(
      <SiteFooter
        {...footer([{ label: "Cookie Policy", href: "/cookie-policy" }])}
      />
    )
    expect(html.indexOf(">Cookie Policy<")).toBeLessThan(
      html.indexOf(">Login<")
    )
  })

  it("is not followed by search engines", () => {
    const html = renderToStaticMarkup(<SiteFooter {...footer()} />)
    expect(loginAnchor(html)?.getAttribute("rel")).toBe("nofollow")
  })
})
