import { describe, expect, it } from "vitest"

import {
  contactPlaceholders,
  interpolate,
  interpolateHref,
  interpolateParts,
  shareHref,
  telHref,
} from "@/lib/interpolate"
import { groupCompaniesFixture } from "@/server/db/seed/fixtures/group-companies"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"

const settings = settingsFixture(fixtureMediaLookup)
const contact = settings.contact

describe("telHref", () => {
  // Every hard-coded tel: href of the static site, from its display number.
  it.each([
    ["(085) 8018746", "tel:+353858018746"],
    ["057 8697670", "tel:+353578697670"],
    ["085 859 1299", "tel:+353858591299"],
    ["(087) 924 8880", "tel:+353879248880"],
    ["085 806 2369", "tel:+353858062369"],
    ["+353 85 801 8746", "tel:+353858018746"],
    ["0044 20 7946 0000", "tel:+442079460000"],
  ])("%s → %s", (phone, expected) => {
    expect(telHref(phone)).toBe(expected)
  })

  it("derives the group companies' hrefs from their phone (static site's phoneHref)", () => {
    // components/home/data.ts groupCompanies[].phoneHref before Phase 3.
    const original: Record<string, string> = {
      "MJS Eco": "tel:+353879248880",
      "Cleaning Partners": "tel:+353858062369",
    }
    const companies = groupCompaniesFixture(fixtureMediaLookup)
    expect(companies.map((c) => c.name)).toEqual(Object.keys(original))
    for (const company of companies)
      expect(telHref(company.phone)).toBe(original[company.name])
  })
})

describe("interpolate", () => {
  it("fills known placeholders and keeps unknown ones", () => {
    expect(interpolate("Call {office} or {other}", { office: "057" })).toBe(
      "Call 057 or {other}"
    )
    expect(interpolate("Page {n}", { n: 2 })).toBe("Page 2")
  })

  it("never re-expands inserted values", () => {
    expect(interpolate("{a}", { a: "{b}", b: "x" })).toBe("{b}")
  })

  it("ignores inherited keys", () => {
    expect(interpolate("{toString}", {})).toBe("{toString}")
  })

  it("reproduces the static site's contact strings", () => {
    const values = contactPlaceholders(contact)
    expect(interpolate("Call 24/7: {phone24h}", values)).toBe(
      "Call 24/7: (085) 8018746"
    )
    expect(interpolate("{phone24hHref}", values)).toBe("tel:+353858018746")
    expect(interpolate("{officeHref}", values)).toBe("tel:+353578697670")
    expect(interpolate("{operationsMobileHref}", values)).toBe(
      "tel:+353858591299"
    )
    expect(interpolate("Tel: {office} Ext 2", values)).toBe(
      "Tel: 057 8697670 Ext 2"
    )
    expect(interpolate("mailto:{operationsEmail}", values)).toBe(
      "mailto:operations@securitypartnersltd.com"
    )
    expect(interpolate("{mapsHref}", values)).toBe(contact.mapsHref)
  })
})

describe("contactPlaceholders", () => {
  it("derives the tel: hrefs from the numbers (not stored); mapsHref is stored", () => {
    const values = contactPlaceholders({
      ...contact,
      phone24h: "01 234 5678",
      office: "(045) 111 2222",
      operationsMobile: "+44 7700 900123",
    })
    expect(values.phone24hHref).toBe("tel:+35312345678")
    expect(values.officeHref).toBe("tel:+353451112222")
    expect(values.operationsMobileHref).toBe("tel:+447700900123")
    expect(values.mapsHref).toBe(contact.mapsHref)
    expect(Object.keys(contact)).not.toContain("phone24hHref")
  })
})

describe("interpolateParts (text-node parity)", () => {
  it("splits literal text and values like JSX `Call {office}`", () => {
    expect(interpolateParts("Call {office}", { office: "057" })).toEqual([
      "Call ",
      "057",
    ])
    expect(
      interpolateParts("No posts in {category} yet.", { category: "X" })
    ).toEqual(["No posts in ", "X", " yet."])
    expect(interpolateParts("Plain", {})).toEqual(["Plain"])
    expect(interpolateParts("{a}{b}", { a: "1", b: "2" })).toEqual(["1", "2"])
    expect(interpolateParts("Keep {unknown}", {})).toEqual(["Keep {unknown}"])
  })
})

describe("interpolateHref (ruling: interpolated hrefs re-checked)", () => {
  it("passes safe results through unchanged", () => {
    const values = contactPlaceholders(contact)
    expect(interpolateHref("/contact", values)).toBe("/contact")
    expect(interpolateHref("{officeHref}", values)).toBe("tel:+353578697670")
    expect(interpolateHref("{mapsHref}", values)).toBe(contact.mapsHref)
  })

  it.each([
    ["{a}", "javascript:alert(1)"],
    ["{a}", "data:text/html,<script>alert(1)</script>"],
    ["/{a}", "/evil.example"],
    ["/{a}", "\\evil.example"],
    ["{a}", "//evil.example"],
    ["{a}", " javascript:alert(1)"],
    ["{a}", "https://ok.example/\u0000"],
  ])("%s with %j → #", (template, value) => {
    expect(interpolateHref(template, { a: value })).toBe("#")
  })

  it("renders an unresolved whole-value placeholder as #", () => {
    expect(interpolateHref("{unknownHref}", {})).toBe("#")
  })
})

describe("shareHref (ruling: {url}/{title} URI-encoded)", () => {
  // Verbatim from components/blog/share-links.tsx before Phase 3.
  const original: Record<string, (url: string, title: string) => string> = {
    Facebook: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    LinkedIn: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    X: (url, title) =>
      `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  }
  const pages = [
    {
      url: "http://localhost:3000/blog/mobile-patrols-protect-your-business-after-hours",
      title: "How Mobile Patrols Protect Your Business After Hours",
    },
    {
      url: "https://example.ie/blog/a?x=1&y=2#top",
      title: "Q&A: “Dinn Rí” — 100% safe? #1 / {url}",
    },
  ]

  it.each(pages)("matches the static site's share URLs for $url", (page) => {
    const networks = settings.microcopy.share.networks
    expect(networks.map((n) => n.name)).toEqual(Object.keys(original))
    for (const network of networks)
      expect(shareHref(network.href, page)).toBe(
        original[network.name](page.url, page.title)
      )
  })
})

describe("seeded href templates all resolve", () => {
  const values = contactPlaceholders(contact)

  /** Every string under an href-like key ("href", "…Href", "link") with a {placeholder}. */
  function templatedHrefs(value: unknown, path = "", out: string[][] = []) {
    if (Array.isArray(value))
      value.forEach((v, i) => templatedHrefs(v, `${path}[${i}]`, out))
    else if (value && typeof value === "object")
      for (const [key, child] of Object.entries(value)) {
        const at = path ? `${path}.${key}` : key
        if (
          typeof child === "string" &&
          /^(href|link)$|Href$/.test(key) &&
          child.includes("{")
        )
          out.push([at, child])
        else templatedHrefs(child, at, out)
      }
    return out
  }

  const hrefs = templatedHrefs({
    settings,
    pages: pagesFixture(fixtureMediaLookup),
  })

  it("finds the templated hrefs", () => {
    expect(hrefs.map(([, href]) => href)).toEqual(
      expect.arrayContaining([
        "{phone24hHref}",
        "{officeHref}",
        "{operationsMobileHref}",
        "mailto:{operationsEmail}",
        "{mapsHref}",
        "https://x.com/intent/post?url={url}&text={title}",
      ])
    )
  })

  it.each(hrefs)("%s (%s) resolves to a safe href", (path, template) => {
    const resolved = path.includes("share.networks")
      ? shareHref(template, { url: "https://example.ie/blog/x", title: "T" })
      : interpolateHref(template, values)
    expect(resolved).not.toBe("#")
    expect(resolved).not.toMatch(/\{\w+\}/)
  })

  it("resolves the contact departments' Operations lines", () => {
    const operations = pagesFixture(
      fixtureMediaLookup
    ).contact.data.departments.items.find((d) => d.title === "Operations")!
    expect(
      operations.lines.map((line) => [
        interpolate(line.text, values),
        interpolateHref(line.href, values),
      ])
    ).toEqual([
      ["Tel: 057 8697670 Ext 2", "tel:+353578697670"],
      ["or 085 859 1299", "tel:+353858591299"],
      [
        "operations@securitypartnersltd.com",
        "mailto:operations@securitypartnersltd.com",
      ],
    ])
  })
})
