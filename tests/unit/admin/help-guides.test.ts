import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { HELP_GUIDES } from "@/components/admin/help/help-view"

describe("Help page guides (MK B7)", () => {
  it("every guide is a section heading of docs/runbook.md", () => {
    const headings = readFileSync("docs/runbook.md", "utf8")
      .split("\n")
      .filter((line) => line.startsWith("## "))
      .map((line) => line.slice(3).trim())
    expect(HELP_GUIDES.length).toBeGreaterThan(0)
    for (const guide of HELP_GUIDES) expect(headings).toContain(guide)
  })
})
