import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { BANNER_PREVIEW_STYLE } from "@/lib/analytics/banner-preview-style"

const globals = readFileSync(
  path.join(import.meta.dirname, "../../../app/globals.css"),
  "utf8"
)

describe("BANNER_PREVIEW_STYLE (admin consent preview)", () => {
  it("carries every public brand colour from app/globals.css, unchanged", () => {
    const site = Object.fromEntries(
      [
        ...globals.matchAll(/(--color-brand-[\w-]+):\s*(#[0-9a-f]{3,8});/gi),
      ].map(([, name, value]) => [name, value])
    )
    expect(Object.keys(site).length).toBeGreaterThanOrEqual(12)
    expect(BANNER_PREVIEW_STYLE).toEqual(site)
  })
})
