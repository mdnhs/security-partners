import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { HELP_GUIDES, helpArticle } from "@/lib/admin/help/registry"

describe("Help page guides (MK B7)", () => {
  it("every guide is a section heading of docs/runbook.md", () => {
    const headings = readFileSync("docs/runbook.md", "utf8")
      .split("\n")
      .filter((line) => line.startsWith("## "))
      .map((line) => line.slice(3).trim())
    expect(HELP_GUIDES.length).toBeGreaterThan(0)
    for (const guide of HELP_GUIDES) expect(headings).toContain(guide)
  })

  it("Troubleshooting lists the same guides", () => {
    const section = helpArticle("troubleshooting")!.sections.find(
      (s) => s.title === "Operations runbook"
    )!
    const list = section.blocks.find((block) => block.type === "list")
    expect(list?.type === "list" ? list.items : []).toEqual(HELP_GUIDES)
  })
})
