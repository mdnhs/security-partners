import { describe, expect, it } from "vitest"

import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { aboutView } from "@/templates/about/view"
import { articleView, blogView } from "@/templates/blog/view"
import { contactView } from "@/templates/contact/view"
import { homeView } from "@/templates/home/view"
import { serviceDetailView, servicesView } from "@/templates/services/view"
import {
  articleMetadata,
  pageMetadata,
  serviceMetadata,
} from "@/templates/shared/page-meta"
import { teamView } from "@/templates/team/view"

const s = fixtureSiteSources()

describe("view builders reproduce the static site's data (fixture sources)", () => {
  it("chrome: header, footer, locale", () => {
    const { chrome } = homeView(s)
    expect(chrome.locale).toBe("en")
    expect(chrome.header.topBar).toEqual({
      phone24hLabel: "24 Hour Number:",
      phone24h: "(085) 8018746",
      phone24hHref: "tel:+353858018746",
      email: "info@securitypartnersltd.com",
      hoursLabel: "Office hours:",
      hours: "Monday–Friday, 9am to 6pm",
    })
    expect(chrome.header.links.map((l) => l.href)).toEqual([
      "/about",
      "/services",
      "/team",
      "/blog",
      "/contact",
    ])
    expect(chrome.footer.contact.officeHref).toBe("tel:+353578697670")
    expect(chrome.footer.group.companies.map((c) => c.logo)).toEqual([
      "/images/group-mjs-eco.png",
      "/images/group-cleaning-partners.png",
    ])
    expect(chrome.footer.legal).toEqual({
      privacy: { label: "Privacy Policy", href: "/privacy" },
      terms: { label: "Terms", href: "/terms" },
    })
  })

  it("home: hero CTA parts, every service, 3 newest non-featured posts", () => {
    const view = homeView(s)
    expect(view.hero.secondaryCta).toEqual({
      label: ["Call 24/7: ", "(085) 8018746"],
      href: "tel:+353858018746",
    })
    expect(view.hero.backgroundImage).toBe("/images/hero.jpg")
    expect(view.services.services).toHaveLength(6)
    expect(view.blog.posts.map((p) => p.slug)).toEqual([
      "mobile-patrols-protect-your-business-after-hours",
      "planning-security-for-your-next-event",
      "inside-our-24-7-operations-team",
    ])
    expect(view.blog.posts[0]).toMatchObject({
      date: "2026-09-12",
      displayDate: "12 Sep 2026",
      category: "Mobile Patrols",
      cover: "/images/hero.jpg",
    })
    expect(view.enquireBanner.secondaryCta).toEqual({
      label: ["Call ", "057 8697670"],
      href: "tel:+353578697670",
    })
    expect(view.team.photoPlaceholder).toBe("/images/team-temp.jpg")
    expect(view.map.href).toBe(s.settings.contact.mapsHref)
  })

  it("contact section and departments interpolate contact values", () => {
    const view = contactView(s)
    expect(view.hero.description).toBe(
      "Get in touch with our team. For urgent matters, our 24 Hour Number is (085) 8018746."
    )
    expect(view.hero.wideDescription).toBe(true)
    expect(view.contact.infoItems[1].lines).toEqual([
      { text: "(085) 8018746", href: "tel:+353858018746" },
    ])
    expect(view.contact.infoItems[2].lines).toEqual([
      { text: "Derryguile, Mountmellick" },
      { text: "Co. Laois, R32 YX49" },
    ])
    expect(view.contact.infoItems[3].lines).toEqual([
      { text: "Tel: 057 8697670 Ext 2", href: "tel:+353578697670" },
      { text: "or 085 859 1299", href: "tel:+353858591299" },
      {
        text: "operations@securitypartnersltd.com",
        href: "mailto:operations@securitypartnersltd.com",
      },
    ])
    expect(view.departments.items[2].lines[0]).toEqual({
      text: "Tel: (057) 8697670 Ext 3",
      href: "tel:+353578697670",
    })
    // Phase 7: the form posts to the leads API; no mailto hand-off.
    expect(view.contact.form).not.toHaveProperty("mailto")
    expect(view.contact.form.labels.submitLabel).toBe("Send Message")
  })

  it("about, services and team pages", () => {
    expect(aboutView(s).values.items.map((i) => i.icon)).toEqual([
      "/images/icon-shield.svg",
      "/images/icon-clock.svg",
      "/images/icon-users.svg",
    ])
    expect(servicesView(s).services.title).toBe("Security For Every Sector")
    expect(teamView(s).officers.className).toBe("bg-brand-surface")
    expect(teamView(s).team.title).toBe("Leadership & Management")
  })

  it("service detail: breadcrumb trail and the next three services, wrapping", () => {
    const view = serviceDetailView(s, "commercial-retail-security")!
    expect(view.hero.trail).toEqual([{ label: "Services", href: "/services" }])
    expect(view.hero.image).toBe("/images/hero.jpg")
    expect(view.others.services.map((x) => x.slug)).toEqual([
      "event-security",
      "alarm-responses",
      "mobile-patrols-key-holding",
    ])
    expect(view.body.operations).toEqual({
      office: "057 8697670",
      officeHref: "tel:+353578697670",
      extension: "Ext 2",
      mobile: "085 859 1299",
      mobileHref: "tel:+353858591299",
      email: "operations@securitypartnersltd.com",
    })
    expect(serviceDetailView(s, "no-such-service")).toBeNull()
  })

  it("blog: featured separate, five filters, page size 6", () => {
    const view = blogView(s)
    expect(view.posts.featured).toMatchObject({
      slug: "18-years-of-watching-over-ireland",
      displayDate: "20 Sep 2026",
      author: { name: "Michael McDonald", role: "Managing Director" },
    })
    expect(view.posts.posts).toHaveLength(6)
    expect(view.posts.filters).toEqual([
      "Company News",
      "Mobile Patrols",
      "Event Security",
      "Retail Security",
      "Alarm Response",
    ])
    expect(view.posts.pageSize).toBe(6)
  })

  it("article: header fallbacks, related/recent exclude the featured article", () => {
    const patrols = articleView(
      s,
      "mobile-patrols-protect-your-business-after-hours"
    )!
    expect(patrols.header.article).toMatchObject({
      readTime: "5 min read",
      lead: "What a scheduled patrol actually covers, and why a visible security presence deters break-ins.",
    })
    expect(patrols.body.tags).toEqual([
      "Mobile Patrols",
      "Key Holding",
      "Business Security",
    ])
    expect(patrols.related.posts.map((p) => p.slug)).toEqual([
      "planning-security-for-your-next-event",
      "inside-our-24-7-operations-team",
      "key-holding-explained",
    ])

    const featured = articleView(s, "18-years-of-watching-over-ireland")!
    expect(featured.header.article.readTime).toBeNull()
    expect(featured.header.article.lead).toBe(s.articles[0].content.excerpt)
    expect(featured.body.body).toBeNull()
    expect(featured.body.tags).toEqual(["Company News"])
    expect(featured.related.posts.map((p) => p.slug)).toEqual([
      "inside-our-24-7-operations-team",
      "mobile-patrols-protect-your-business-after-hours",
      "planning-security-for-your-next-event",
    ])
    expect(featured.body.recent.map((p) => p.slug)).toEqual([
      "mobile-patrols-protect-your-business-after-hours",
      "planning-security-for-your-next-event",
      "inside-our-24-7-operations-team",
    ])
    expect(featured.body.categories).toEqual([
      { name: "Company News", count: 2 },
      { name: "Mobile Patrols", count: 1 },
      { name: "Event Security", count: 1 },
      { name: "Retail Security", count: 1 },
      { name: "Alarm Response", count: 0 },
    ])
    expect(articleView(s, "no-such-article")).toBeNull()
  })

  it("metadata matches the static site's titles and descriptions", () => {
    expect(pageMetadata(s, "home")).toEqual({
      title: "Security Partners Ltd. | Watching Over You",
      description:
        "Proactive, flexible and customer-focused security services across Ireland, backed by a dedicated 24/7 operations team. Based in Mountmellick, Co. Laois since 2008.",
    })
    expect(pageMetadata(s, "about").title).toBe(
      "About Us | Security Partners Ltd."
    )
    expect(pageMetadata(s, "contact").description).toBe(
      "Get in touch with our team. For urgent matters, our 24 Hour Number is (085) 8018746."
    )
    expect(serviceMetadata(s, "alarm-responses")).toEqual({
      title: "Alarm Responses | Security Partners Ltd.",
      description:
        "Our highly trained security team will be dispatched to your premises and deal with the situation, day or night.",
    })
    expect(articleMetadata(s, "key-holding-explained")).toEqual({
      title:
        "Key Holding Explained: Who Responds When Your Alarm Goes Off | Security Partners Ltd.",
      description:
        "What happens after an alarm activation, and why a key holder saves you a call-out.",
    })
    expect(serviceMetadata(s, "nope")).toEqual({})
  })
})
