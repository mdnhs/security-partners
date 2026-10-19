import { globSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const root = path.join(import.meta.dirname, "../../..")

describe("admin controls (MK parity A5)", () => {
  it("admin code uses shadcn Select/Table/Checkbox/RadioGroup, not native elements", () => {
    const files = globSync("{components/admin,app/(admin)}/**/*.tsx", {
      cwd: root,
    })
    // The scan must actually reach both trees.
    expect(files.some((f) => f.startsWith("components/admin/"))).toBe(true)
    expect(files.some((f) => f.startsWith("app/(admin)/"))).toBe(true)
    const hits = files.filter((f) =>
      /<select[\s>]|<table[\s>]|type="(checkbox|radio)"/.test(
        readFileSync(path.join(root, f), "utf8")
      )
    )
    expect(hits).toEqual([])
  })
})
