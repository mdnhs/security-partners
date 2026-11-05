import { describe, expect, it } from "vitest"

import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { applyView } from "@/templates/careers/apply-view"

const s = fixtureSiteSources()
const page = s.pages.careers.data

describe("applyView without a job (the talent pool, /careers/apply)", () => {
  const view = applyView(s, null, new Date("2026-11-05T10:00:00Z"), {
    months: 12,
    keepMonths: 24,
  })

  it("is always open and posts no job slug", () => {
    expect(view.open).toBe(true)
    expect(view.closedNotice).toBeNull()
    expect(view.jobSlug).toBe("")
  })

  it("uses the talent-pool copy and links back to the listing", () => {
    expect(view.hero.title).toBe(page.cta.heading)
    expect(view.hero.description).toBe(page.cta.copy)
    expect(view.sidebar.jobTitle).toBe(page.cta.eyebrow)
    expect(view.sidebar.meta).toBeNull()
    expect(view.backHref).toBe("/careers")
    expect(view.sidebar.viewJob).toBe(page.job.similar.viewAllLabel)
  })
})

describe("the privacy and keep-on-file copy follows Settings › Careers", () => {
  it("fills {months} and {keepMonths}", () => {
    const zoned = {
      ...s,
      pages: {
        ...s.pages,
        careers: {
          ...s.pages.careers,
          data: {
            ...page,
            apply: {
              ...page.apply,
              consents: ["a", "b", "Keep me on file for {keepMonths} months."],
              sidebar: {
                ...page.apply.sidebar,
                dataCopy: "Deleted after {months} months.",
              },
            },
          },
        },
      },
    }
    const view = applyView(zoned, null, new Date(), { months: 6, keepMonths: 18 })
    expect(view.sidebar.dataCopy).toBe("Deleted after 6 months.")
    expect(view.copy.consents[2]).toBe("Keep me on file for 18 months.")
  })
})
