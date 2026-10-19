import { globSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const root = path.join(import.meta.dirname, "../../..")

/**
 * A native select or table, or a checkbox/radio input, in any quoting:
 * `type="checkbox"`, `type='radio'`, `type={"checkbox"}`, `type={'radio'}`.
 */
const NATIVE_CONTROL =
  /<select[\s>]|<table[\s>]|type=\{?\s*["'`](checkbox|radio)["'`]\s*\}?/

describe("admin controls (MK parity A5)", () => {
  it("admin code uses shadcn Select/Table/Checkbox/RadioGroup, not native elements", () => {
    const files = globSync("{components/admin,app/(admin)}/**/*.tsx", {
      cwd: root,
    })
    // The scan must actually reach both trees.
    expect(files.some((f) => f.startsWith("components/admin/"))).toBe(true)
    expect(files.some((f) => f.startsWith("app/(admin)/"))).toBe(true)
    const hits = files.filter((f) =>
      NATIVE_CONTROL.test(readFileSync(path.join(root, f), "utf8"))
    )
    expect(hits).toEqual([])
  })

  it("the pattern catches every quoting of a checkbox or radio input", () => {
    for (const source of [
      `<input type="checkbox" />`,
      `<input type='checkbox' />`,
      `<input type={"checkbox"} />`,
      `<input type={'radio'} />`,
      "<input type={`radio`} />",
      `<input type="radio" />`,
      `<select>`,
      `<table className="x">`,
    ])
      expect(source).toMatch(NATIVE_CONTROL)
    for (const source of [
      `<input type="text" />`,
      `<Checkbox />`,
      `<Table>`,
      `<SelectTrigger>`,
    ])
      expect(source).not.toMatch(NATIVE_CONTROL)
  })
})
