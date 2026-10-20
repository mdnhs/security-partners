import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const GUARD = 'test.skip(process.platform !== "darwin"'

describe("visual specs run on macOS only (ledger ruling; P00-2)", () => {
  it("every tests/visual spec starts with the darwin guard", () => {
    const specs = readdirSync("tests/visual").filter((f) =>
      f.endsWith(".spec.ts")
    )
    expect(specs.length).toBeGreaterThan(0)
    for (const spec of specs)
      expect(readFileSync(join("tests/visual", spec), "utf8"), spec).toContain(
        GUARD
      )
  })
})
