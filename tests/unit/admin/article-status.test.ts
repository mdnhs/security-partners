import { describe, expect, it } from "vitest"

import {
  ARTICLE_STATUS_FILTERS,
  articleListHref,
  articleStatusLabel,
  parseStatusParam,
} from "@/lib/admin/article-status"
import { formatDateTime } from "@/lib/format"

const base = { live: false, dirty: true, scheduledAt: null }

describe("article status badges", () => {
  it("names each workflow state", () => {
    expect(articleStatusLabel({ ...base, status: "draft" })).toEqual({
      text: "Draft",
      variant: "outline",
    })
    expect(articleStatusLabel({ ...base, status: "in_review" })).toEqual({
      text: "In review",
      variant: "secondary",
    })
    expect(
      articleStatusLabel({
        ...base,
        status: "scheduled",
        scheduledAt: "2099-07-01T09:00:00.000Z",
      })
    ).toEqual({
      text: `Scheduled · ${formatDateTime("2099-07-01T09:00:00.000Z")}`,
      variant: "secondary",
    })
    expect(
      articleStatusLabel({
        status: "published",
        live: true,
        dirty: false,
        scheduledAt: null,
      })
    ).toEqual({ text: "Published", variant: "default" })
    expect(
      articleStatusLabel({
        status: "published",
        live: true,
        dirty: true,
        scheduledAt: null,
      })
    ).toEqual({ text: "Unpublished changes", variant: "secondary" })
  })

  it("parses the ?status= filter and builds list links", () => {
    expect(parseStatusParam("in_review")).toBe("in_review")
    expect(parseStatusParam("nope")).toBeNull()
    expect(parseStatusParam(null)).toBeNull()
    expect(articleListHref(null)).toBe("/admin/insights")
    expect(articleListHref("scheduled")).toBe(
      "/admin/insights?status=scheduled"
    )
    expect(ARTICLE_STATUS_FILTERS.map((f) => f.label)).toEqual([
      "All",
      "Drafts",
      "In review",
      "Scheduled",
      "Published",
    ])
  })
})
