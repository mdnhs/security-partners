import { describe, expect, it } from "vitest"

import {
  LEAD_STATUS_BADGE,
  leadExportHref,
  leadFilterQuery,
  parseLeadFilters,
} from "@/lib/admin/leads"
import { LEAD_STATUSES } from "@/lib/schemas/api/leads"

describe("lead inbox helpers", () => {
  it("parses only known filter values from the URL", () => {
    expect(
      parseLeadFilters(new URLSearchParams("status=new&assignee=none"))
    ).toEqual({ status: "new", assignee: "none" })
    expect(
      parseLeadFilters(new URLSearchParams("status=open&assignee=me"))
    ).toEqual({ status: "open", assignee: "me" })
    expect(
      parseLeadFilters(
        new URLSearchParams("assignee=0190a6e0-0000-7000-8000-000000000001")
      )
    ).toEqual({ status: "", assignee: "0190a6e0-0000-7000-8000-000000000001" })
    expect(
      parseLeadFilters(new URLSearchParams("status=maybe&assignee=bob"))
    ).toEqual({ status: "", assignee: "" })
  })

  it("omits empty filters from queries and export links", () => {
    expect(leadFilterQuery({ status: "", assignee: "" })).toEqual({})
    expect(leadFilterQuery({ status: "spam", assignee: "me" })).toEqual({
      status: "spam",
      assignee: "me",
    })
    expect(leadExportHref({})).toBe("/api/v1/admin/leads/export.csv")
    expect(leadExportHref({ status: "open", assignee: "" })).toBe(
      "/api/v1/admin/leads/export.csv?status=open"
    )
    expect(leadExportHref({ email: "a+b@example.ie", status: "all" })).toBe(
      "/api/v1/admin/leads/export.csv?status=all&email=a%2Bb%40example.ie"
    )
  })

  it("has a badge variant for every status", () => {
    expect(Object.keys(LEAD_STATUS_BADGE).sort()).toEqual(
      [...LEAD_STATUSES].sort()
    )
  })
})
