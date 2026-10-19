import { globSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const root = path.join(import.meta.dirname, "../../..")

// A6 moves components/admin/schema-form/** onto shadcn primitives in parallel;
// it removes this ignore when it lands.
const IGNORE = ["components/admin/schema-form/**"]

describe("admin controls (MK parity A5)", () => {
  it("admin code uses shadcn Select/Table, not native elements", () => {
    const files = globSync("{components/admin,app/(admin)}/**/*.tsx", {
      cwd: root,
      exclude: IGNORE,
    })
    // The scan must actually reach both trees.
    expect(files.some((f) => f.startsWith("components/admin/"))).toBe(true)
    expect(files.some((f) => f.startsWith("app/(admin)/"))).toBe(true)
    const hits = files.filter((f) =>
      /<select[\s>]|<table[\s>]/.test(readFileSync(path.join(root, f), "utf8"))
    )
    expect(hits).toEqual([])
  })
})
