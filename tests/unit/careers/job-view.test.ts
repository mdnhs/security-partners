import { describe, expect, it } from "vitest"

import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { jobView } from "@/templates/careers/job-view"

import { jobRecord } from "./fixtures"

const NOW = new Date("2026-11-10T12:00:00Z")
const s = fixtureSiteSources()
const page = s.pages.careers.data

const job = jobRecord("static-officer", {
  title: "Static Security Officer",
  offers: [{ icon: "euro", text: "Night shift premium" }],
  offerIntro: "Competitive pay, plus:",
})
const others = [
  jobRecord("other-static", { title: "Other Static" }, "2026-11-01T09:00:00Z"),
  jobRecord(
    "patrol",
    { title: "Patrol", category: "Mobile Patrol" },
    "2026-11-09T09:00:00Z"
  ),
  jobRecord(
    "cctv",
    { title: "CCTV", category: "Monitoring" },
    "2026-11-07T09:00:00Z"
  ),
  jobRecord(
    "events",
    { title: "Events", category: "Events" },
    "2026-11-06T09:00:00Z"
  ),
  jobRecord(
    "closed-static",
    { title: "Closed", filled: true },
    "2026-11-09T09:00:00Z"
  ),
]

describe("jobView", () => {
  it("hero: breadcrumb through Careers, Now Hiring and category tags, Apply and Share", () => {
    const view = jobView(s, job, [job, ...others], NOW)
    expect(view.hero.trail).toEqual([
      { label: page.hero.crumb, href: "/careers" },
    ])
    expect(view.hero.crumb).toBe("Static Security Officer")
    expect(view.hero.tags.map((t) => t.label)).toEqual([
      page.tags.nowHiring,
      "Static Guarding",
    ])
    expect(view.applyHref).toBe("/careers/static-officer/apply")
    expect(view.closedNotice).toBeNull()
  })

  it("summary: reference, location, type, hours, pay, start and the closing date written out", () => {
    const view = jobView(s, job, [job], NOW)
    expect(view.summary.rows.map((r) => [r.label, r.value])).toEqual([
      [page.job.summary.reference, "SP-2611-STA"],
      [page.job.summary.location, "Portlaoise, Co. Laois"],
      [page.job.summary.jobType, "Full-time"],
      [page.job.summary.hours, "4-on-4-off, 12hr day/night shifts"],
      [page.job.summary.pay, "€15.50–€16.50/hr"],
      [page.job.summary.startDate, "December 2026"],
      [page.job.summary.closingDate, "30 November 2026"],
    ])
  })

  it("similar roles: open only, same category first, then newest, never itself, at most 3", () => {
    const view = jobView(s, job, [job, ...others], NOW)
    expect(view.similar.map((c) => c.slug)).toEqual([
      "other-static",
      "patrol",
      "cctv",
    ])
  })

  it("a closed role: no Apply, the closed notice and a Closed tag", () => {
    const closed = jobRecord("gone", { filled: true })
    const view = jobView(s, closed, [closed], NOW)
    expect(view.applyHref).toBeNull()
    expect(view.closedNotice).toBe(page.job.closedNotice)
    expect(view.hero.tags[0]).toEqual({
      label: page.tags.closed,
      tone: "closed",
    })
  })

  it("leaves out empty optional sections", () => {
    const bare = jobRecord("bare", {
      desirable: [],
      offers: [],
      offerIntro: "",
    })
    const view = jobView(s, bare, [bare], NOW)
    expect(view.lookingFor.desirable).toBeNull()
    expect(view.offer).toBeNull()
    expect(view.similar).toEqual([])
  })

  it("offers keep their icon and text after the intro", () => {
    const view = jobView(s, job, [job], NOW)
    expect(view.offer).toEqual({
      heading: page.job.offerHeading,
      intro: "Competitive pay, plus:",
      items: [{ icon: "euro", text: "Night shift premium" }],
    })
  })
})
