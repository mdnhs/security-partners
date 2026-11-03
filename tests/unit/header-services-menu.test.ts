import { describe, expect, it } from "vitest"

import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { chromeView } from "@/templates/shared/views"

describe("chromeView Services menu", () => {
  it("gives the Services header link one child per published service", () => {
    const s = fixtureSiteSources()
    const { header } = chromeView(s)
    const services = header.links.find((l) => l.href === "/services")!
    expect(services.children).toEqual(
      s.services.map((x) => ({
        label: x.content.title,
        href: `/services/${x.slug}`,
        icon: x.content.icon.url,
      }))
    )
    for (const child of services.children!) expect(child.icon).toBeTruthy()
    expect(services.children!.length).toBeGreaterThan(0)
  })

  it("other header links, the footer links and the CTA carry no children", () => {
    const { header, footer } = chromeView(fixtureSiteSources())
    for (const link of header.links.filter((l) => l.href !== "/services"))
      expect(Object.keys(link)).not.toContain("children")
    for (const link of footer.quickLinks.links)
      expect(Object.keys(link)).not.toContain("children")
    expect(Object.keys(header.cta)).not.toContain("children")
  })

  it("no services → no children key at all (the page payload stays as before)", () => {
    const s = { ...fixtureSiteSources(), services: [] }
    const { header } = chromeView(s)
    const services = header.links.find((l) => l.href === "/services")!
    expect(Object.keys(services)).not.toContain("children")
  })
})
