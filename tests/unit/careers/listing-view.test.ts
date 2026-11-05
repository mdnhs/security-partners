import { describe, expect, it } from "vitest"

import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { careersView, postedAgo } from "@/templates/careers/view"

import { jobRecord } from "./fixtures"

const NOW = new Date("2026-11-10T12:00:00Z")
const s = fixtureSiteSources()

const jobs = [
  jobRecord(
    "static-officer",
    { title: "Static Security Officer" },
    "2026-11-08T09:00:00Z"
  ),
  jobRecord(
    "mobile-patrol",
    {
      title: "Mobile Patrol Officer",
      category: "Mobile Patrol",
      location: "Laois & Offaly",
      licence: "Security Guard (Static)",
      urgent: true,
    },
    "2026-11-05T09:00:00Z"
  ),
  jobRecord(
    "cctv",
    {
      title: "CCTV Operator",
      category: "Monitoring",
      licence: "Monitoring Centre Operative",
    },
    "2026-10-30T09:00:00Z"
  ),
  jobRecord("retail", { title: "Retail Officer", closingDate: "2026-09-20" }),
  jobRecord("site", {
    title: "Site Officer",
    filled: true,
    closingDate: "2026-12-30",
  }),
]

describe("careersView", () => {
  it("lists open jobs newest first with their card text", () => {
    const view = careersView(s, jobs, NOW)
    expect(view.openings.jobs.map((j) => j.slug)).toEqual([
      "static-officer",
      "mobile-patrol",
      "cctv",
    ])
    expect(view.openings.jobs[0]).toMatchObject({
      href: "/careers/static-officer",
      category: "Static Guarding",
      tag: { label: "Open", tone: "open" },
      posted: "Posted 2 days ago",
    })
    expect(view.openings.jobs[1].tag).toEqual({
      label: "Urgent",
      tone: "urgent",
    })
    expect(view.openings.countLabel).toBe("3 open roles")
  })

  it("chips: All Roles with the total, then each category of the open jobs with its count, in listing order", () => {
    const view = careersView(s, jobs, NOW)
    expect(view.openings.allRolesLabel).toBe("All Roles (3)")
    expect(view.openings.categories).toEqual([
      { label: "Static Guarding", count: 1 },
      { label: "Mobile Patrol", count: 1 },
      { label: "Monitoring", count: 1 },
    ])
  })

  it("filter options are the distinct locations and licence types of the open jobs, sorted", () => {
    const view = careersView(s, jobs, NOW)
    expect(view.openings.locations).toEqual([
      "Laois & Offaly",
      "Portlaoise, Co. Laois",
    ])
    expect(view.openings.licences).toEqual([
      "Monitoring Centre Operative",
      "Security Guard (Static)",
    ])
  })

  it("previous openings: filled or expired, latest closing first, with the closed-on date", () => {
    const view = careersView(s, jobs, NOW)
    expect(view.previous?.jobs.map((j) => j.slug)).toEqual(["site", "retail"])
    expect(view.previous?.jobs[1].closedOn).toBe("Closed on 20 Sep 2026")
    expect(view.previous?.jobs[1].filledLabel).toBe("Position Filled")
  })

  it("no open jobs: the empty copy, no chips; no previous jobs: the section is left out", () => {
    const view = careersView(s, [], NOW)
    expect(view.openings.jobs).toEqual([])
    expect(view.openings.categories).toEqual([])
    expect(view.openings.empty).toEqual({
      title: s.pages.careers.data.openings.emptyTitle,
      text: s.pages.careers.data.openings.emptyText,
    })
    expect(view.previous).toBeNull()
  })

  it("hero, why-join cards, process steps and the CTA come from the page", () => {
    const view = careersView(s, jobs, NOW)
    expect(view.hero.title).toBe("Careers")
    expect(view.whyJoin.cards).toHaveLength(4)
    expect(view.process.steps[0]).toEqual({
      number: "01",
      title: "Apply Online",
      description: s.pages.careers.data.process.steps[0].description,
    })
    expect(view.cta.primary.label).toBe("Send Us Your CV")
  })
})

describe("postedAgo", () => {
  const at = (iso: string) => postedAgo(new Date(iso), NOW)
  it.each([
    ["2026-11-10T08:00:00Z", "today"],
    ["2026-11-09T08:00:00Z", "1 day ago"],
    ["2026-11-05T08:00:00Z", "5 days ago"],
    ["2026-11-03T08:00:00Z", "1 week ago"],
    ["2026-10-20T08:00:00Z", "3 weeks ago"],
    ["2026-09-01T08:00:00Z", "2 months ago"],
  ])("%s → %s", (iso, expected) => expect(at(iso)).toBe(expected))
})

describe("the closed-on date is the job's calendar date in every site time zone", () => {
  it.each(["Pacific/Kiritimati", "Pacific/Pago_Pago", "Europe/Dublin"])(
    "%s",
    (timezone) => {
      const zoned = {
        ...s,
        settings: { ...s.settings, site: { ...s.settings.site, timezone } },
      }
      const view = careersView(zoned, jobs, NOW)
      expect(view.previous?.jobs[1].closedOn).toBe("Closed on 20 Sep 2026")
    }
  )
})
